import { supabase } from "../lib/supabase";
import type { AuditEvent } from "../types/signing";

export interface SignatureAuditData {
  signatureId: string;
  documentId: string;
  documentTitle: string;
  signerName: string;
  signerEmail: string;
  status: string;
  signedAt: string | null;
  sentAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  documentHash: string | null;
  fullName: string | null;
  documentNumber: string | null;
  cuilCuit: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  faceVerificationMethod: string | null;
  faceSimilarityScore: number | null;
  certificateSerial: string | null;
  pdfUrl: string | null;
  signatureUrl: string | null;
  verificationCode: string | null;
}

function mapRowToEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id:           row.id as string,
    action:       row.action as string,
    entityType:   row.entity_type as string,
    entityId:     (row.entity_id as string) ?? null,
    documentHash: (row.document_hash as string) ?? null,
    ipAddress:    (row.ip_address as string) ?? null,
    userAgent:    (row.user_agent as string) ?? null,
    metadata:     (row.metadata as Record<string, unknown>) ?? {},
    createdAt:    row.created_at as string,
  };
}

/** Audit events for the currently authenticated user */
export async function getMyAuditEvents(): Promise<AuditEvent[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEvent(row as Record<string, unknown>));
}

/** All audit events — admin only (RLS enforces this) */
export async function getAllAuditEvents(): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEvent(row as Record<string, unknown>));
}

/** Audit events related to a specific document */
export async function getDocumentAuditEvents(documentId: string): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .or(`entity_id.eq.${documentId},metadata->>documentId.eq.${documentId}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToEvent(row as Record<string, unknown>));
}

/** Full audit data for a specific signature */
export async function getSignatureAuditData(signatureId: string): Promise<SignatureAuditData | null> {
  const { data: sr, error: srErr } = await supabase
    .from("signature_requests")
    .select(`
      id, signer_email, signer_name, status, sent_at, signed_at,
      document:documents(id, title),
      signature:signatures(
        id, signed_at, ip_address, user_agent, document_hash,
        full_name, document_number, cuil_cuit, address, city, province,
        phone, email, birth_date, face_verification_method, face_similarity_score,
        certificate_serial, pdf_url, signature_url
      )
    `)
    .eq("id", signatureId)
    .maybeSingle();

  if (srErr || !sr) return null;

  const sig = (sr.signature as unknown as Record<string, unknown> | null) ?? null;
  const doc = (sr.document as unknown as Record<string, unknown> | null) ?? null;

  return {
    signatureId: sr.id as string,
    documentId: (doc?.id as string) ?? "",
    documentTitle: (doc?.title as string) ?? "",
    signerName: (sr.signer_name as string) ?? "",
    signerEmail: (sr.signer_email as string) ?? "",
    status: (sr.status as string) ?? "",
    signedAt: (sr.signed_at as string) ?? null,
    sentAt: (sr.sent_at as string) ?? "",
    ipAddress: (sig?.ip_address as string) ?? null,
    userAgent: (sig?.user_agent as string) ?? null,
    documentHash: (sig?.document_hash as string) ?? null,
    fullName: (sig?.full_name as string) ?? null,
    documentNumber: (sig?.document_number as string) ?? null,
    cuilCuit: (sig?.cuil_cuit as string) ?? null,
    address: (sig?.address as string) ?? null,
    city: (sig?.city as string) ?? null,
    province: (sig?.province as string) ?? null,
    phone: (sig?.phone as string) ?? null,
    email: (sig?.email as string) ?? null,
    birthDate: (sig?.birth_date as string) ?? null,
    faceVerificationMethod: (sig?.face_verification_method as string) ?? null,
    faceSimilarityScore: (sig?.face_similarity_score as number) ?? null,
    certificateSerial: (sig?.certificate_serial as string) ?? null,
    pdfUrl: (sig?.pdf_url as string) ?? null,
    signatureUrl: (sig?.signature_url as string) ?? null,
    verificationCode: (sig?.verification_code as string) ?? null,
  };
}
