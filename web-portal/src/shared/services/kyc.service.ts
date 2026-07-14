import { supabase } from "../lib/supabase";
import { APP_CONFIG } from "../config/app";
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
      const storagePath = d.storage_path as string | undefined;
      if (storagePath) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 3600);
        if (signedData?.signedUrl) {
          previewUrl = signedData.signedUrl;
        } else {
          console.error("[kyc] createSignedUrl failed", { storagePath, error: signedError });
          // Fallback: download and create object URL
          try {
            const { data: blobData } = await supabase.storage
              .from(BUCKET)
              .download(storagePath);
            if (blobData) {
              previewUrl = URL.createObjectURL(blobData);
            }
          } catch (downloadErr) {
            console.error("[kyc] download fallback also failed", { storagePath, error: downloadErr });
          }
        }
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

  const hasPersonalData = row.full_name || row.document_number || row.birth_date || row.phone || row.address;
  const personalData: KycPersonalData | null = hasPersonalData
    ? {
        fullName:       (row.full_name       as string) ?? "",
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
    provider:        row.provider as string | undefined,
    providerSessionUrl: row.provider_session_url as string | undefined,
    providerSessionToken: row.provider_session_token as string | undefined,
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

export async function startProviderVerification(): Promise<{
  sessionId: string;
  url: string;
  token: string;
}> {
  const { data, error } = await supabase.functions.invoke("kyc-create-session");
  if (error) throw new Error(error.message);
  return data;
}

/** Mock KYC: marca la verificación como VERIFIED sin llamar a DIDIT.
 *  Se usa cuando no hay DIDIT configurado (desarrollo/testing). */
export async function mockCompleteKyc(userId: string): Promise<KycVerification | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error("No autenticado");

  const { data: existing } = await supabase
    .from("identity_verifications")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["PENDING", "IN_REVIEW"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const verificationId = existing?.id ?? (
    await supabase
      .from("identity_verifications")
      .insert({ user_id: userId, status: "PENDING", provider: "mock" })
      .select("id")
      .single()
  ).data?.id;

  if (!verificationId) throw new Error("No se pudo crear la verificación");

  await supabase
    .from("identity_verifications")
    .update({
      status: "VERIFIED",
      provider: "mock",
      provider_session_url: null,
      provider_session_id: null,
      provider_session_token: null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", verificationId);

  await supabase
    .from("users")
    .update({ verification_status: "VERIFIED" })
    .eq("id", userId);

  return getMyVerification(userId);
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("No autenticado");
  
  const user = session.user;
  const orgId = user.user_metadata?.organization_id || "default";

  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${orgId}/${user.id}/${verificationId}/${type}_${Date.now()}.${ext}`;

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
