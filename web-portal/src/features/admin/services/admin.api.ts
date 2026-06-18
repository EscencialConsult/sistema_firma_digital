import { supabase } from "../../../shared/lib/supabase";
import type { IdentityDocument, IdentityAuditLog, IdentityVerification } from "../../identity/types/identity.types";

function mapIdentityRow(row: any): IdentityVerification {
  const docRows = row.identity_documents ?? row.documents ?? [];
  const auditRows = row.audit_logs ?? [];

  const documents: IdentityDocument[] = docRows.map((d: any) => ({
    id: d.id,
    type: d.type,
    fileName: d.file_name ?? d.fileName ?? "",
    mimeType: d.mime_type ?? d.mimeType ?? "",
    fileSize: d.file_size ?? d.fileSize ?? 0,
    checksumSha256: d.checksum_sha256 ?? d.checksumSha256 ?? "",
    uploadedAt: d.uploaded_at ?? d.uploadedAt ?? "",
    storagePath: d.storage_path ?? d.storagePath ?? undefined,
  }));

  const auditLogs: IdentityAuditLog[] = auditRows.map((a: any) => ({
    id: a.id,
    action: a.action,
    createdAt: a.created_at ?? a.createdAt ?? "",
    metadata: a.metadata ?? {},
  }));

  return {
    id: row.id,
    status: row.status,
    fullName: row.full_name ?? row.fullName,
    documentType: row.document_type ?? row.documentType,
    documentNumber: row.document_number ?? row.documentNumber,
    birthDate: row.birth_date ?? row.birthDate,
    nationality: row.nationality,
    country: row.country,
    province: row.province,
    city: row.city,
    address: row.address,
    phone: row.phone,
    email: row.email,
    cuitCuil: row.cuil_cuit ?? row.cuitCuil,
    declarationAccepted: row.declaration_accepted ?? row.declarationAccepted,
    declarationText: row.declaration_text ?? row.declarationText,
    declarationVersion: row.declaration_version ?? row.declarationVersion,
    termsAccepted: row.terms_accepted ?? row.termsAccepted,
    termsAcceptedAt: row.terms_accepted_at ?? row.termsAcceptedAt,
    requestHash: row.request_hash ?? row.requestHash,
    submittedAt: row.submitted_at ?? row.submittedAt,
    reviewedAt: row.reviewed_at ?? row.reviewedAt,
    rejectionReason: row.rejection_reason ?? row.rejectionReason,
    expiresAt: row.expires_at ?? row.expiresAt,
    documents,
    auditLogs,
  };
}

export type AdminStats = {
  users: number;
  documents: number;
  signatureRequests: number;
  identityPending: number;
  organizations: number;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  verification_status: string;
  certificate_status: string;
  created_at: string;
};

export type AdminUserDetail = {
  user: AdminUserRecord;
  documents: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  certificates: Array<{
    id: string;
    label: string;
    status: string;
    issuer?: string;
    valid_to?: string;
  }>;
  identity: {
    id: string;
    status: string;
    document_type?: string;
    document_number?: string;
    submitted_at?: string;
    rejection_reason?: string;
  } | null;
};

export const adminApi = {
  async stats() {
    const { count: users } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    const { count: documents } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });
    const { count: signatureRequests } = await supabase
      .from("signature_requests")
      .select("*", { count: "exact", head: true });
    const { count: identityPending } = await supabase
      .from("identity_verifications")
      .select("*", { count: "exact", head: true })
      .in("status", ["PENDING", "IN_REVIEW"]);
    const { count: organizations } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true });

    return {
      users: users ?? 0,
      documents: documents ?? 0,
      signatureRequests: signatureRequests ?? 0,
      identityPending: identityPending ?? 0,
      organizations: organizations ?? 0,
    } satisfies AdminStats;
  },
  async listUsers() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as AdminUserRecord[];
  },
  async getUserDetails(id: string) {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (userError) throw userError;

    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, status, created_at")
      .eq("user_id", id);

    const { data: certificates } = await supabase
      .from("certificates")
      .select("id, label, status, issuer, valid_to")
      .eq("user_id", id);

    const { data: identity } = await supabase
      .from("identity_verifications")
      .select("id, status, document_type, document_number, submitted_at, rejection_reason")
      .eq("user_id", id)
      .maybeSingle();

    return {
      user: user as AdminUserRecord,
      documents: (documents ?? []) as AdminUserDetail["documents"],
      certificates: (certificates ?? []) as AdminUserDetail["certificates"],
      identity: identity as AdminUserDetail["identity"],
    } satisfies AdminUserDetail;
  },
  async identityVerifications() {
    const { data, error } = await supabase
      .from("identity_verifications")
      .select("*, identity_documents(*), audit_logs(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapIdentityRow(row));
  },
  async approveIdentity(id: string) {
    const { error } = await supabase
      .from("identity_verifications")
      .update({ status: "VERIFIED" })
      .eq("id", id);
    if (error) throw error;
  },
  async rejectIdentity(id: string, reason: string) {
    const { error } = await supabase
      .from("identity_verifications")
      .update({ status: "REJECTED", rejection_reason: reason })
      .eq("id", id);
    if (error) throw error;
  }
};
