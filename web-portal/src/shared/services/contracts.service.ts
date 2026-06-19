import { supabase } from "../lib/supabase";
import type { Contract, ContractDetail, ContractSigner } from "../types/contract";

// ─── Convenio types ───────────────────────────────────────────────────────────

export interface ConvenioInfo {
  documentId:                string;
  documentTitle:             string;
  documentStatus:            string;
  documentCreatedAt:         string;
  authorityId:               string;
  authorityName:             string;
  authorityEmail:            string;
  authoritySigningRequestId: string;
  authoritySigningStatus:    string;
  recipientName:             string | null;
  recipientEmail:            string | null;
  recipientSigningStatus:    string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function latestVersion(versions: Array<Record<string, unknown>>) {
  return [...versions].sort(
    (a, b) => (b.version_number as number) - (a.version_number as number)
  )[0] ?? null;
}

function mapDocToContract(doc: Record<string, unknown>): Contract {
  const versions = (doc.document_versions as Array<Record<string, unknown>>) ?? [];
  const v = latestVersion(versions);
  const owner = (doc.owner as Record<string, unknown>) ?? {};

  return {
    id:               doc.id as string,
    title:            doc.title as string,
    description:      (doc.description as string) ?? "",
    status:           doc.status as Contract["status"],
    ownerEmail:       (owner.email as string) ?? "",
    sha256Hash:       (v?.sha256_hash as string) ?? "",
    versionNumber:    (v?.version_number as number) ?? 1,
    fileName:         (v?.file_name as string) ?? "",
    totalSigners:     (doc.total_signers as number) ?? 0,
    completedSigners: (doc.completed_signers as number) ?? 0,
    finalPdfUrl:      (doc.final_pdf_url as string) ?? null,
    createdAt:        doc.created_at as string,
    updatedAt:        doc.updated_at as string,
  };
}

function mapSrToSigner(sr: Record<string, unknown>): ContractSigner {
  return {
    id:        sr.id as string,
    email:     sr.signer_email as string,
    name:      sr.signer_name as string,
    status:    sr.status as ContractSigner["status"],
    sentAt:    sr.sent_at as string,
    viewedAt:  (sr.viewed_at as string) ?? null,
    signedAt:  (sr.completed_at as string) ?? null,
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
      signature_requests(*)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const versions  = (data.document_versions as Array<Record<string, unknown>>) ?? [];
  const v         = latestVersion(versions);
  const signers   = ((data.signature_requests as Array<Record<string, unknown>>) ?? []).map(mapSrToSigner);
  const pdfUrl    = v?.storage_path
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
    const authSR    = allSRs.find((sr) => sr.id === auth.signing_request_id);
    const recipSR   = allSRs.find((sr) => sr.id !== auth.signing_request_id);

    result.push({
      documentId:                auth.document_id as string,
      documentTitle:             doc.title as string,
      documentStatus:            doc.status as string,
      documentCreatedAt:         doc.created_at as string,
      authorityId:               auth.id as string,
      authorityName:             auth.full_name as string,
      authorityEmail:            auth.email as string,
      authoritySigningRequestId: auth.signing_request_id as string,
      authoritySigningStatus:    (authSR?.status as string) ?? "PENDING",
      recipientName:             (recipSR?.signer_name as string) ?? null,
      recipientEmail:            (recipSR?.signer_email as string) ?? null,
      recipientSigningStatus:    (recipSR?.status as string) ?? null,
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
    document_id:     documentId,
    signer_email:    recipient.email,
    signer_name:     recipient.name,
    signer_dni:      recipient.dni ?? null,
    signer_cuil:     recipient.cuil ?? null,
    signer_domicilio:recipient.domicilio ?? null,
    status:          "PENDING",
    expires_at:      expiresAt,
    signing_order:   1,
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
      total_signers:   ((doc?.total_signers as number) ?? 1) + 1,
      status:          "SENT",
      template_fields: {
        ...existing,
        nombre_firmante_2:    recipient.name,
        email_firmante_2:     recipient.email,
        dni_firmante_2:       recipient.dni ?? "",
        cuil_firmante_2:      recipient.cuil ?? "",
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
    document_id:  documentId,
    signer_email: signer.email,
    signer_name:  signer.name,
    status:       "PENDING",
    expires_at:   expiresAt,
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

/** Create a new contract document — if no signers, stays DRAFT until assignContractToUser is called */
export async function createContract(input: {
  title: string;
  description: string;
  templateId?: string;
  templateFields?: Record<string, string>;
  signers: { email: string; name: string }[];
}): Promise<Contract> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title:           input.title,
      description:     input.description,
      owner_id:        user.id,
      template_id:     input.templateId ?? null,
      template_fields: input.templateFields ?? null,
      total_signers:   input.signers.length,
      status:          "DRAFT",
    })
    .select("*, owner:users!owner_id(email), document_versions:document_versions!document_versions_document_id_fkey(*)")
    .single();

  if (docError || !doc) throw new Error(docError?.message ?? "Error al crear el contrato");

  if (input.signers.length > 0) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const srInserts = input.signers.map((s) => ({
      document_id:  doc.id,
      signer_email: s.email,
      signer_name:  s.name,
      status:       "PENDING",
      expires_at:   expiresAt,
    }));
    const { error: srError } = await supabase.from("signature_requests").insert(srInserts);
    if (srError) throw new Error(srError.message);

    await supabase.from("documents").update({ status: "SENT" }).eq("id", doc.id);

    for (const s of input.signers) {
      supabase.functions
        .invoke("send-signing-email", {
          body: {
            signerEmail:   s.email,
            signerName:    s.name,
            documentTitle: input.title,
            requestId:     doc.id,
          },
        })
        .catch((e: unknown) => console.warn(`[email] Edge Function no disponible para ${s.email}:`, e));
    }
  }

  return mapDocToContract(doc as Record<string, unknown>);
}

/** Assign a DRAFT contract to a user → creates signature_request and changes status to SENT */
export async function assignContractToUser(
  documentId: string,
  user: { email: string; name: string; dni?: string | null; cuil?: string | null; domicilio?: string | null }
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: srErr } = await supabase.from("signature_requests").insert({
    document_id:  documentId,
    signer_email: user.email,
    signer_name:  user.name,
    signer_cuil:  user.cuil ?? null,
    status:       "PENDING",
    expires_at:   expiresAt,
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
    total_signers:   1,
    status:          "SENT",
    template_fields: {
      ...existing,
      nombre_firmante:    user.name,
      email_firmante:     user.email,
      dni_firmante:       user.dni    ?? "",
      cuil_firmante:      user.cuil   ?? "",
      domicilio_firmante: user.domicilio ?? "",
    },
  }).eq("id", documentId);
}

