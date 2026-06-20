import { supabase } from "../../../shared/lib/supabase";
import type { IdentityVerification, IdentityDocument, IdentityAuditLog, PersonalData } from "../types/identity.types";

const IDENTITY_BUCKET = "kyc-documents";

function mapRow(row: any): IdentityVerification {
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

export const identityApi = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null };
    const { data, error } = await supabase
      .from("identity_verifications")
      .select("*, identity_documents(*), audit_logs(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { data: data ? mapRow(data) : null };
  },
  async start() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("identity_verifications")
      .insert({ user_id: user.id, email: user.email, status: "PENDING" })
      .select("*, identity_documents(*), audit_logs(*)")
      .single();
    if (error) throw error;
    return { data: mapRow(data) };
  },
  async updatePersonalData(data: PersonalData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("identity_verifications")
      .update({
        full_name: data.fullName || null,
        document_type: data.documentType || "DNI",
        document_number: data.documentNumber || null,
        birth_date: data.birthDate || null,
        nationality: data.nationality || null,
        country: data.country || null,
        province: data.province || null,
        city: data.city || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        cuil_cuit: data.cuitCuil || null,
      })
      .eq("user_id", user.id);
    if (error) throw error;
  },
  async submit(payload: { declarationAccepted: true; declarationText: string; declarationVersion: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("identity_verifications")
      .update({
        status: "IN_REVIEW",
        submitted_at: new Date().toISOString(),
        declaration_accepted: payload.declarationAccepted,
        declaration_text: payload.declarationText,
        declaration_version: payload.declarationVersion,
      })
      .eq("user_id", user.id);
    if (error) throw error;
  },
  async uploadDocumentFront(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/DOCUMENT_FRONT_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(IDENTITY_BUCKET)
      .upload(path, file);
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase
      .from("identity_documents")
      .upsert({
        user_id: user.id,
        type: "DOCUMENT_FRONT",
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      }, { onConflict: "user_id,type" });
    if (insertError) throw insertError;
  },
  async uploadDocumentBack(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/DOCUMENT_BACK_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(IDENTITY_BUCKET)
      .upload(path, file);
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase
      .from("identity_documents")
      .upsert({
        user_id: user.id,
        type: "DOCUMENT_BACK",
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      }, { onConflict: "user_id,type" });
    if (insertError) throw insertError;
  },
  async uploadSelfie(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/SELFIE_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(IDENTITY_BUCKET)
      .upload(path, file);
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase
      .from("identity_documents")
      .upsert({
        user_id: user.id,
        type: "SELFIE",
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: path,
      }, { onConflict: "user_id,type" });
    if (insertError) throw insertError;
  }
};
