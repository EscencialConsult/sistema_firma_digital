import { supabase } from "../lib/supabase";
import type { Contract, ContractDetail, ContractSigner, SignaturePosition } from "../types/contract";
import { DEFAULT_SIGNATURE_POSITION } from "../types/contract";

// ─── Convenio types ───────────────────────────────────────────────────────────

export interface ConvenioInfo {
  documentId: string;
  documentTitle: string;
  documentStatus: string;
  documentCreatedAt: string;
  authorityId: string;
  authorityName: string;
  authorityEmail: string;
  authoritySigningRequestId: string;
  authoritySigningStatus: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientSigningStatus: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function latestVersion(versions: Array<Record<string, unknown>>) {
  return [...versions].sort(
    (a, b) => (b.version_number as number) - (a.version_number as number)
  )[0] ?? null;
}

function originalVersion(versions: Array<Record<string, unknown>>) {
  return [...versions].sort(
    (a, b) => (a.version_number as number) - (b.version_number as number)
  )[0] ?? null;
}

function mapDocToContract(doc: Record<string, unknown>): Contract {
  const versions = (doc.document_versions as Array<Record<string, unknown>>) ?? [];
  const v = latestVersion(versions);
  const originalV = originalVersion(versions);
  const owner = (doc.owner as Record<string, unknown>) ?? {};
  const rawFields = doc.template_fields as Record<string, unknown> | null;
  const pdfUrl = v?.storage_path
    ? supabase.storage.from("contract-pdfs").getPublicUrl(v.storage_path as string).data.publicUrl
    : null;

  return {
    id: doc.id as string,
    title: doc.title as string,
    description: (doc.description as string) ?? "",
    status: doc.status as Contract["status"],
    ownerEmail: (owner.email as string) ?? "",
    sha256Hash: (v?.sha256_hash as string) ?? "",
    versionNumber: (v?.version_number as number) ?? 1,
    fileName: (originalV?.file_name as string) ?? (v?.file_name as string) ?? "",
    totalSigners: (doc.total_signers as number) ?? 0,
    completedSigners: (doc.completed_signers as number) ?? 0,
    finalPdfUrl: pdfUrl ?? (doc.final_pdf_url as string) ?? null,
    createdAt: doc.created_at as string,
    updatedAt: doc.updated_at as string,
    templateId: (doc.template_id as string) ?? null,
    templateFields: rawFields
      ? Object.fromEntries(Object.entries(rawFields).map(([k, v]) => [k, String(v ?? "")]))
      : null,
    contractTypeId: (doc.contract_type_id as string) ?? null,
    paymentTemplateId: (doc.payment_template_id as string) ?? null,
    signaturePosition: (doc.signature_position as SignaturePosition) ?? DEFAULT_SIGNATURE_POSITION,
  };
}

function mapSrToSigner(sr: Record<string, unknown>): ContractSigner {
  const sigs = (sr.signatures as Array<Record<string, unknown>>) ?? [];
  const latestSig = [...sigs].sort(
    (a, b) => new Date(b.signed_at as string).getTime() - new Date(a.signed_at as string).getTime()
  )[0];
  return {
    id: sr.id as string,
    email: sr.signer_email as string,
    name: sr.signer_name as string,
    status: sr.status as ContractSigner["status"],
    sentAt: sr.sent_at as string,
    viewedAt: (sr.viewed_at as string) ?? null,
    signedAt: (sr.signed_at as string) ?? null,
    signatureUrl: (latestSig?.signature_data as string) ?? (sr.signature_url as string) ?? null,
  };
}

// ─── User-facing ──────────────────────────────────────────────────────────────

/** Contracts owned by the current authenticated user */
export async function getMyContracts(): Promise<Contract[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("*, owner:users!owner_id(email), document_versions:document_versions!document_versions_document_id_fkey(*)")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDocToContract);
}

/** Full contract detail including signers and PDF URL */
export async function getContractById(id: string): Promise<ContractDetail | null> {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      owner:users!owner_id(email),
      document_versions:document_versions!document_versions_document_id_fkey(*),
      signature_requests(*, signatures(signature_data, signed_at))
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const versions = (data.document_versions as Array<Record<string, unknown>>) ?? [];
  const v = latestVersion(versions);
  const signers = ((data.signature_requests as Array<Record<string, unknown>>) ?? []).map(mapSrToSigner);
  const pdfUrl = v?.storage_path
    ? supabase.storage.from("contract-pdfs").getPublicUrl(v.storage_path as string).data.publicUrl
    : null;

  return {
    ...mapDocToContract(data as Record<string, unknown>),
    signers,
    pdfUrl,
  };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

/** All contracts in the system — excludes convenio docs (admin only) */
export async function getAllContracts(): Promise<Contract[]> {
  const { data: convenioLinks } = await supabase
    .from("organization_authorities")
    .select("document_id")
    .eq("type", "PROVISIONAL")
    .not("document_id", "is", null);

  const convenioIds = new Set(
    (convenioLinks ?? []).map((r) => r.document_id as string).filter(Boolean)
  );

  const { data, error } = await supabase
    .from("documents")
    .select("*, owner:users!owner_id(email), document_versions:document_versions!document_versions_document_id_fkey(*)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((d) => !convenioIds.has(d.id as string))
    .map(mapDocToContract);
}

/** All convenio documents with their provisional authority and signing status */
export async function getConvenios(): Promise<ConvenioInfo[]> {
  const { data: authorities, error } = await supabase
    .from("organization_authorities")
    .select("id, full_name, email, signing_request_id, document_id")
    .eq("type", "PROVISIONAL")
    .not("document_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!authorities || authorities.length === 0) return [];

  const docIds = authorities.map((a) => a.document_id as string).filter(Boolean);

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, status, created_at, signature_requests(*)")
    .in("id", docIds);

  const docsMap = new Map((docs ?? []).map((d) => [d.id as string, d]));

  const result: ConvenioInfo[] = [];
  for (const auth of authorities) {
    const doc = docsMap.get(auth.document_id as string);
    if (!doc) continue;

    const allSRs = (doc.signature_requests ?? []) as Array<Record<string, unknown>>;
    const authSR = allSRs.find((sr) => sr.id === auth.signing_request_id);
    const recipSR = allSRs.find((sr) => sr.id !== auth.signing_request_id);

    result.push({
      documentId: auth.document_id as string,
      documentTitle: doc.title as string,
      documentStatus: doc.status as string,
      documentCreatedAt: doc.created_at as string,
      authorityId: auth.id as string,
      authorityName: auth.full_name as string,
      authorityEmail: auth.email as string,
      authoritySigningRequestId: auth.signing_request_id as string,
      authoritySigningStatus: (authSR?.status as string) ?? "PENDING",
      recipientName: (recipSR?.signer_name as string) ?? null,
      recipientEmail: (recipSR?.signer_email as string) ?? null,
      recipientSigningStatus: (recipSR?.status as string) ?? null,
    });
  }
  return result;
}

/** Assigns a recipient to an existing convenio after the authority has signed */
export async function assignConvenioRecipient(
  documentId: string,
  recipient: { name: string; email: string; dni?: string; cuil?: string; domicilio?: string }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("signature_requests").insert({
    document_id: documentId,
    signer_email: recipient.email,
    signer_name: recipient.name,
    signer_dni: recipient.dni ?? null,
    signer_cuil: recipient.cuil ?? null,
    signer_domicilio: recipient.domicilio ?? null,
    status: "PENDING",
    expires_at: expiresAt,
    signing_order: 1,
  });
  if (error) throw new Error(error.message);

  const { data: doc } = await supabase
    .from("documents")
    .select("total_signers, template_fields")
    .eq("id", documentId)
    .single();

  const existing = (doc?.template_fields as Record<string, string>) ?? {};
  await supabase
    .from("documents")
    .update({
      total_signers: ((doc?.total_signers as number) ?? 1) + 1,
      status: "SENT",
      template_fields: {
        ...existing,
        nombre_firmante_2: recipient.name,
        email_firmante_2: recipient.email,
        dni_firmante_2: recipient.dni ?? "",
        cuil_firmante_2: recipient.cuil ?? "",
        domicilio_firmante_2: recipient.domicilio ?? "",
      },
    })
    .eq("id", documentId);
}

/** Send an already-completed document to an additional third-party signer */
export async function sendDocumentToThirdParty(
  documentId: string,
  signer: { email: string; name: string }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: srErr } = await supabase.from("signature_requests").insert({
    document_id: documentId,
    signer_email: signer.email,
    signer_name: signer.name,
    status: "PENDING",
    expires_at: expiresAt,
  });
  if (srErr) throw new Error(srErr.message);

  const { data: doc } = await supabase
    .from("documents")
    .select("total_signers")
    .eq("id", documentId)
    .single();

  await supabase
    .from("documents")
    .update({
      total_signers: ((doc?.total_signers as number) ?? 0) + 1,
      status: "SENT",
    })
    .eq("id", documentId);
}

export async function addContractSigner(
  documentId: string,
  signer: { email: string; name: string; cuil?: string | null }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: doc } = await supabase
    .from("documents")
    .select("title, total_signers")
    .eq("id", documentId)
    .single();

  const { data: sr, error: srErr } = await supabase
    .from("signature_requests")
    .insert({
      document_id: documentId,
      signer_email: signer.email,
      signer_name: signer.name,
      signer_cuil: signer.cuil ?? null,
      status: "PENDING",
      expires_at: expiresAt,
      signing_order: (doc?.total_signers as number ?? 0),
    })
    .select("id")
    .single();
  if (srErr || !sr) throw new Error(srErr?.message ?? "Error agregando firmante");

  await supabase
    .from("documents")
    .update({
      total_signers: ((doc?.total_signers as number) ?? 0) + 1,
      status: "SENT",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  await supabase.functions.invoke("send-signing-email", {
    body: {
      signerEmail: signer.email,
      signerName: signer.name,
      documentTitle: (doc?.title as string) ?? "Documento",
      requestId: sr.id,
    },
  }).catch(() => {});
}

export async function removeContractSigner(signatureRequestId: string): Promise<void> {
  const { data: sr, error: srErr } = await supabase
    .from("signature_requests")
    .select("id, document_id, status")
    .eq("id", signatureRequestId)
    .single();
  if (srErr || !sr) throw new Error(srErr?.message ?? "Firmante no encontrado");
  if (sr.status === "SIGNED") throw new Error("No se puede quitar un firmante que ya firmó.");

  const documentId = sr.document_id as string;
  const { error: deleteErr } = await supabase
    .from("signature_requests")
    .delete()
    .eq("id", signatureRequestId);
  if (deleteErr) throw new Error(deleteErr.message);

  const { data: remaining } = await supabase
    .from("signature_requests")
    .select("status")
    .eq("document_id", documentId);

  const total = remaining?.length ?? 0;
  const completed = (remaining ?? []).filter((r) => r.status === "SIGNED").length;
  const status = total === 0 ? "DRAFT" : completed >= total ? "COMPLETED" : "SENT";

  const { error: updateErr } = await supabase
    .from("documents")
    .update({
      total_signers: total,
      completed_signers: completed,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (updateErr) throw new Error(updateErr.message);
}

/** Create a new contract document — if no signers, stays DRAFT until assignContractToUser is called */
export async function createContract(input: {
  title: string;
  description: string;
  templateId?: string;
  templateFields?: Record<string, string>;
  signaturePosition?: SignaturePosition;
  signers: { email: string; name: string }[];
}): Promise<Contract> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title: input.title,
      description: input.description,
      owner_id: user.id,
      template_id: input.templateId ?? null,
      template_fields: input.templateFields ?? null,
      signature_position: input.signaturePosition ?? DEFAULT_SIGNATURE_POSITION,
      total_signers: input.signers.length,
      status: "DRAFT",
    })
    .select("*, owner:users!owner_id(email), document_versions:document_versions!document_versions_document_id_fkey(*)")
    .single();

  if (docError || !doc) throw new Error(docError?.message ?? "Error al crear el contrato");

  if (input.signers.length > 0) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const srInserts = input.signers.map((s) => ({
      document_id: doc.id,
      signer_email: s.email,
      signer_name: s.name,
      status: "PENDING",
      expires_at: expiresAt,
    }));
    const { error: srError } = await supabase.from("signature_requests").insert(srInserts);
    if (srError) throw new Error(srError.message);

    await supabase.from("documents").update({ status: "SENT" }).eq("id", doc.id);

    for (const s of input.signers) {
      supabase.functions
        .invoke("send-signing-email", {
          body: {
            signerEmail: s.email,
            signerName: s.name,
            documentTitle: input.title,
            requestId: doc.id,
          },
        })
        .catch((e: unknown) => console.warn(`[email] Edge Function no disponible para ${s.email}:`, e));
    }
  }

  return mapDocToContract(doc as Record<string, unknown>);
}

/** Assign a DRAFT contract to a user and set the authority who signs for Escencial SAS */
export async function assignContractToUser(
  documentId: string,
  user: { email: string; name: string; dni?: string | null; cuil?: string | null; domicilio?: string | null },
  authority: { fullName: string; cuil?: string | null; email: string; signatureUrl?: string | null }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: srErr } = await supabase.from("signature_requests").insert({
    document_id: documentId,
    signer_email: user.email,
    signer_name: user.name,
    signer_cuil: user.cuil ?? null,
    status: "PENDING",
    expires_at: expiresAt,
    signing_order: 0,
  });
  if (srErr) throw new Error(srErr.message);

  const { data: doc } = await supabase
    .from("documents")
    .select("template_fields")
    .eq("id", documentId)
    .single();

  const existing = (doc?.template_fields as Record<string, string>) ?? {};
  await supabase.from("documents").update({
    total_signers: 1,
    status: "SENT",
    template_fields: {
      ...existing,
      // Destinatario (firma izquierda)
      nombre_firmante: user.name,
      email_firmante: user.email,
      dni_firmante: user.dni ?? "",
      cuil_firmante: user.cuil ?? "",
      domicilio_firmante: user.domicilio ?? "",
      // Autoridad firmante por Escencial SAS (firma derecha)
      autoridad_nombre: authority.fullName,
      autoridad_cuil: authority.cuil ?? "",
      autoridad_email: authority.email,
      autoridad_signature_url: authority.signatureUrl ?? "",
    },
  }).eq("id", documentId);
}

/**
 * Send a contract directly from a DB template in one step.
 * Creates document as SENT + signature_request. No DRAFT intermediate state.
 */
export async function sendContractFromTemplate(input: {
  title:          string;
  description:    string;
  templateFields: Record<string, string>;  // includes _templateContent, _legalTitle, _dbTemplateId + all vars
  user: {
    email:     string;
    name:      string;
    dni?:      string | null;
    cuil?:     string | null;
    domicilio?: string | null;
  };
  authority: {
    fullName:     string;
    cuil?:        string | null;
    email:        string;
    signatureUrl?: string | null;
  };
  paymentTemplateId?: string | null;
  signaturePosition?: SignaturePosition;
}): Promise<Contract> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error("No autenticado");

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const allFields: Record<string, string> = {
    ...input.templateFields,
    // User vars (custom templates)
    nombre_usuario:          input.user.name,
    email_usuario:           input.user.email,
    dni_usuario:             input.user.dni       ?? "",
    cuil_usuario:            input.user.cuil      ?? "",
    domicilio_usuario:       input.user.domicilio ?? "",
    // Legacy vars (React templates)
    nombre_firmante:         input.user.name,
    email_firmante:          input.user.email,
    dni_firmante:            input.user.dni       ?? "",
    cuil_firmante:           input.user.cuil      ?? "",
    domicilio_firmante:      input.user.domicilio ?? "",
    // Authority
    autoridad_nombre:        input.authority.fullName,
    autoridad_cuil:          input.authority.cuil   ?? "",
    autoridad_email:         input.authority.email,
    autoridad_signature_url: input.authority.signatureUrl ?? "",
  };

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title:               input.title,
      description:         input.description,
      owner_id:            authUser.id,
      template_id:         "custom",
      template_fields:     allFields,
      signature_position:  input.signaturePosition ?? DEFAULT_SIGNATURE_POSITION,
      total_signers:       1,
      status:              "SENT",
      payment_template_id: input.paymentTemplateId ?? null,
    })
    .select("*, owner:users!owner_id(email), document_versions:document_versions!document_versions_document_id_fkey(*)")
    .single();

  if (docError || !doc) throw new Error(docError?.message ?? "Error creando contrato");

  // Cargar nombre y logo de la org del usuario para guardarlo en la fila del firmante
  const { data: userRow } = await supabase
    .from("users").select("organization_id").eq("id", authUser.id).maybeSingle();
  let orgName: string | null = null;
  let orgLogo: string | null = null;
  if (userRow?.organization_id) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name, logo_light_url, logo_dark_url")
      .eq("id", userRow.organization_id)
      .maybeSingle();
    orgName = (orgRow?.name as string) ?? null;
    orgLogo = ((orgRow?.logo_light_url ?? orgRow?.logo_dark_url) as string) ?? null;
  }

  const { error: srErr } = await supabase.from("signature_requests").insert({
    document_id:       doc.id,
    document_title:    input.title,
    organization_name: orgName,
    organization_logo: orgLogo,
    signer_email:      input.user.email,
    signer_name:       input.user.name,
    signer_cuil:       input.user.cuil ?? null,
    status:            "PENDING",
    expires_at:        expiresAt,
    signing_order:     0,
  });
  if (srErr) throw new Error(srErr.message);

  return mapDocToContract(doc as Record<string, unknown>);
}

/** Upload a PDF file and create a signing request for it.
 *  Steps: upload file → compute SHA-256 → create document → create version → create signature_request.
 *  Returns the created Contract with the signature_request ID. */
export async function uploadContractPdf(input: {
  file: File;
  title: string;
  description?: string;
  signerName: string;
  signerEmail: string;
  signerCuil?: string;
  ownerId: string;
  signaturePosition?: SignaturePosition;
}): Promise<{ contract: Contract; requestId: string }> {
  const { file, title, description, signerName, signerEmail, signerCuil, ownerId } = input;

  // 1. Compute SHA-256
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // 2. Upload file to storage
  const storagePath = `${ownerId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("contract-pdfs")
    .upload(storagePath, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`);

  // 3. Create document
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title: title || file.name,
      description: description || null,
      owner_id: ownerId,
      template_id: "custom",
      template_fields: {
        nombre_firmante: signerName,
        email_firmante: signerEmail,
        cuil_firmante: signerCuil ?? "",
        nombre_usuario: signerName,
        email_usuario: signerEmail,
      },
      signature_position: input.signaturePosition ?? DEFAULT_SIGNATURE_POSITION,
      total_signers: 1,
      status: "SENT",
    })
    .select("*, owner:users!owner_id(email)")
    .single();
  if (docError || !doc) throw new Error(docError?.message ?? "Error creando documento");

  // 4. Create document version
  const { error: verError } = await supabase.from("document_versions").insert({
    document_id: doc.id,
    version_number: 1,
    file_name: file.name,
    storage_path: storagePath,
    sha256_hash: sha256Hash,
    file_size: file.size,
    uploaded_by: ownerId,
  });
  if (verError) throw new Error(verError.message);

  // 5. Create signature_request
  const { data: sr, error: srError } = await supabase
    .from("signature_requests")
    .insert({
      document_id: doc.id,
      document_version_id: undefined,
      signer_email: signerEmail,
      signer_name: signerName,
      signer_cuil: signerCuil || null,
      status: "PENDING",
      expires_at: expiresAt,
      signing_order: 0,
    })
    .select("id")
    .single();
  if (srError || !sr) throw new Error(srError?.message ?? "Error creando solicitud de firma");

  // 6. Try to send email (silent if fails)
  await supabase.functions.invoke("send-signing-email", {
    body: {
      signerEmail,
      signerName,
      documentTitle: title || file.name,
      requestId: sr.id,
    },
  }).catch(() => {});

  return { contract: mapDocToContract(doc as Record<string, unknown>), requestId: sr.id };
}

/** Update template fields of an existing DRAFT contract */
export async function updateContractFields(
  documentId: string,
  templateFields: Record<string, string>
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ template_fields: templateFields })
    .eq("id", documentId);
  if (error) throw new Error(error.message);
}

/** Delete a contract and all its related data (signature_requests, document_versions, files in storage) */
export async function deleteContract(documentId: string): Promise<void> {
  // 1. Get document versions to remove storage files
  const { data: versions, error: verErr } = await supabase
    .from("document_versions")
    .select("storage_path")
    .eq("document_id", documentId);
  if (verErr) console.warn("[deleteContract] error fetching versions:", verErr.message);

  // 2. Remove storage files
  if (versions && versions.length > 0) {
    const paths = versions.map((v) => v.storage_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from("contract-pdfs").remove(paths);
      if (storageErr) console.warn("[deleteContract] error removing storage files:", storageErr.message);
    }
  }

  // 3. Unlink organization_authorities referencing this document (no ON DELETE CASCADE)
  const { error: authErr } = await supabase
    .from("organization_authorities")
    .update({ document_id: null, signing_request_id: null })
    .eq("document_id", documentId);
  if (authErr) console.warn("[deleteContract] error unlinking authorities:", authErr.message);

  // 4. Delete signature_requests (cascades signatures, conformity_acceptances, otp_challenges)
  const { error: srErr } = await supabase
    .from("signature_requests")
    .delete()
    .eq("document_id", documentId);
  if (srErr) throw new Error(`Error al eliminar solicitudes de firma: ${srErr.message}`);

  // 5. Delete document_versions
  const { error: dvErr } = await supabase
    .from("document_versions")
    .delete()
    .eq("document_id", documentId);
  if (dvErr) console.warn("[deleteContract] error deleting versions:", dvErr.message);

  // 6. Delete the document
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(`Error al eliminar documento: ${error.message}`);
}

