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
    .select("*, owner:users!owner_id(email), document_versions(*)")
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
      document_versions(*),
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
    .select("*, owner:users!owner_id(email), document_versions(*)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDocToContract);
}

/** Create a new contract document and its first signature request */
export async function createContract(input: {
  title: string;
  description: string;
  templateId?: string;
  templateFields?: Record<string, string>;
  signerEmail: string;
  signerName: string;
}): Promise<Contract> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Insert document
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title:           input.title,
      description:     input.description,
      owner_id:        user.id,
      template_id:     input.templateId ?? null,
      template_fields: input.templateFields ?? null,
      total_signers:   1,
      status:          "DRAFT",
    })
    .select("*, owner:users!owner_id(email), document_versions(*)")
    .single();

  if (docError || !doc) throw new Error(docError?.message ?? "Error al crear el contrato");

  // 2. Insert first signature request
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("signature_requests").insert({
    document_id:  doc.id,
    signer_email: input.signerEmail,
    signer_name:  input.signerName,
    status:       "PENDING",
    expires_at:   expiresAt,
  });

  // 3. Update status to SENT
  await supabase.from("documents").update({ status: "SENT" }).eq("id", doc.id);

  return mapDocToContract(doc as Record<string, unknown>);
}
