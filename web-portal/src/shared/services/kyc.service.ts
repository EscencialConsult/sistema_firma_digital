import { supabase } from "../lib/supabase";
import type { KycVerification, KycPersonalData, KycDocument, KycDocumentType, KycStatus } from "../types/kyc";

const BUCKET = "kyc-documents";

// ─── Mappers ──────────────────────────────────────────────────────────────────

async function mapRowToVerification(
  row: Record<string, unknown>
): Promise<KycVerification> {
  const docRows = (row.identity_documents as Array<Record<string, unknown>>) ?? [];

  // Generate signed URLs for each document (valid 1 hour)
  const documents: KycDocument[] = await Promise.all(
    docRows.map(async (d) => {
      let previewUrl: string | undefined;
      if (d.storage_path) {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(d.storage_path as string, 3600);
        previewUrl = data?.signedUrl;
      }
      return {
        id:          d.id as string,
        type:        d.type as KycDocumentType,
        fileName:    d.file_name as string,
        mimeType:    (d.mime_type as string) ?? "",
        fileSize:    (d.file_size as number) ?? 0,
        uploadedAt:  (d.uploaded_at as string) ?? "",
        previewUrl,
      };
    })
  );

  const personalData: KycPersonalData | null = row.full_name
    ? {
        fullName:       row.full_name       as string,
        documentType:   (row.document_type   as string) ?? "",
        documentNumber: (row.document_number as string) ?? "",
        cuilCuit:       (row.cuil_cuit       as string) ?? "",
        birthDate:      (row.birth_date      as string) ?? "",
        phone:          (row.phone           as string) ?? "",
        address:        (row.address         as string) ?? "",
        city:           (row.city            as string) ?? "",
        province:       (row.province        as string) ?? "",
        country:        (row.country         as string) ?? "",
      }
    : null;

  return {
    id:              row.id as string,
    userId:          row.user_id as string,
    status:          row.status as KycStatus,
    personalData,
    documents,
    submittedAt:     (row.submitted_at as string) ?? null,
    reviewedAt:      (row.reviewed_at as string) ?? null,
    reviewedBy:      (row.reviewed_by as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    createdAt:       row.created_at as string,
  };
}

// ─── User-facing ──────────────────────────────────────────────────────────────

export async function getMyVerification(userId: string): Promise<KycVerification | null> {
  const { data, error } = await supabase
    .from("identity_verifications")
    .select("*, identity_documents(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRowToVerification(data as Record<string, unknown>);
}

export async function startVerification(userId: string): Promise<KycVerification> {
  // Return existing PENDING verification if one already exists
  const existing = await getMyVerification(userId);
  if (existing && existing.status === "PENDING") return existing;

  const { data, error } = await supabase
    .from("identity_verifications")
    .insert({ user_id: userId, status: "PENDING" })
    .select("*, identity_documents(*)")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Error al iniciar verificación");
  return mapRowToVerification(data as Record<string, unknown>);
}

export async function savePersonalData(
  verificationId: string,
  data: KycPersonalData
): Promise<KycPersonalData> {
  const { error } = await supabase
    .from("identity_verifications")
    .update({
      full_name:       data.fullName       || null,
      document_type:   data.documentType   || "DNI",
      document_number: data.documentNumber || null,
      cuil_cuit:       data.cuilCuit       || null,
      birth_date:      data.birthDate      || null,
      phone:           data.phone          || null,
      address:         data.address        || null,
      city:            data.city           || null,
      province:        data.province       || null,
      country:         data.country        || "Argentina",
    })
    .eq("id", verificationId);

  if (error) throw new Error(error.message);
  return data;
}

export async function uploadDocument(
  verificationId: string,
  type: KycDocumentType,
  file: File
): Promise<KycDocument> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${verificationId}/${type}_${Date.now()}.${ext}`;

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  // Signed URL for preview
  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  // Insert document record — upsert por si el usuario reintenta el mismo tipo
  const { data: doc, error: dbError } = await supabase
    .from("identity_documents")
    .upsert({
      verification_id: verificationId,
      type,
      file_name:       file.name,
      mime_type:       file.type,
      file_size:       file.size,
      storage_path:    path,
    }, { onConflict: "verification_id,type" })
    .select()
    .single();

  if (dbError || !doc) throw new Error(dbError?.message ?? "Error al guardar el documento");

  return {
    id:         doc.id as string,
    type:       doc.type as KycDocumentType,
    fileName:   doc.file_name as string,
    mimeType:   doc.mime_type as string,
    fileSize:   doc.file_size as number,
    uploadedAt: doc.uploaded_at as string,
    previewUrl: signedData?.signedUrl,
  };
}

export async function submitVerification(verificationId: string): Promise<void> {
  const { error } = await supabase
    .from("identity_verifications")
    .update({
      status:       "IN_REVIEW",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", verificationId);

  if (error) throw new Error(error.message);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listAllVerifications(statusFilter?: string): Promise<KycVerification[]> {
  let query = supabase
    .from("identity_verifications")
    .select("*, identity_documents(*)")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return Promise.all((data ?? []).map((row) => mapRowToVerification(row as Record<string, unknown>)));
}

export async function getVerificationById(id: string): Promise<KycVerification | null> {
  const { data, error } = await supabase
    .from("identity_verifications")
    .select("*, identity_documents(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRowToVerification(data as Record<string, unknown>);
}

export async function approveVerification(id: string, adminId: string): Promise<void> {
  const now = new Date().toISOString();

  // Get user_id from the verification
  const { data: verif } = await supabase
    .from("identity_verifications")
    .select("user_id")
    .eq("id", id)
    .single();

  await supabase
    .from("identity_verifications")
    .update({ status: "VERIFIED", reviewed_at: now, reviewed_by: adminId })
    .eq("id", id);

  // Trigger fn_on_kyc_status_change handles this, but update directly as fallback
  if (verif?.user_id) {
    await supabase
      .from("users")
      .update({ verification_status: "VERIFIED" })
      .eq("id", verif.user_id);
  }
}

export async function rejectVerification(
  id: string,
  adminId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();

  const { data: verif } = await supabase
    .from("identity_verifications")
    .select("user_id")
    .eq("id", id)
    .single();

  await supabase
    .from("identity_verifications")
    .update({
      status:           "REJECTED",
      reviewed_at:      now,
      reviewed_by:      adminId,
      rejection_reason: reason,
    })
    .eq("id", id);

  if (verif?.user_id) {
    await supabase
      .from("users")
      .update({ verification_status: "REJECTED" })
      .eq("id", verif.user_id);
  }
}
