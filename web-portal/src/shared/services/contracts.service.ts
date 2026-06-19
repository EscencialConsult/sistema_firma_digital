import { supabase } from "../lib/supabase";
import type { Contract, ContractDetail, ContractSigner } from "../types/contract";

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

/** All contracts in the system (admin only — RLS enforces this) */
export async function getAllContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*, owner:users!owner_id(email), document_versions:document_versions!document_versions_document_id_fkey(*)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDocToContract);
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

/** Create a new contract document and its signature requests */
export async function createContract(input: {
  title: string;
  description: string;
  templateId?: string;
  templateFields?: Record<string, string>;
  signers: { email: string; name: string }[];
}): Promise<Contract> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  if (!input.signers || input.signers.length === 0) {
    throw new Error("Se requiere al menos un firmante");
  }

  // 1. Insert document
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

  // 2. Insert signature requests
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const srInserts = input.signers.map(s => ({
    document_id:  doc.id,
    signer_email: s.email,
    signer_name:  s.name,
    status:       "PENDING",
    expires_at:   expiresAt,
  }));

  const { error: srError } = await supabase.from("signature_requests").insert(srInserts);
  if (srError) throw new Error(srError.message);

  // 3. Update status to SENT
  await supabase.from("documents").update({ status: "SENT" }).eq("id", doc.id);

  // 4. Notify all signers by email (Edge Function — requires deploy + RESEND_API_KEY)
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

  return mapDocToContract(doc as Record<string, unknown>);
}

