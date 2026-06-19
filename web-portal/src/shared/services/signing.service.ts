import { supabase } from "../lib/supabase";
import type { SigningRequest, SignatureResult } from "../types/signing";
import { generateSignedPdf } from "../utils/generateSignedPdf";

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapRowToSigningRequest(
  sr: Record<string, unknown>,
  doc?: Record<string, unknown>
): SigningRequest {
  const document = doc ?? (sr.documents as Record<string, unknown>) ?? {};
  const versions = (document.document_versions as Array<Record<string, unknown>>) ?? [];
  const latestV  = [...versions].sort(
    (a, b) => (b.version_number as number) - (a.version_number as number)
  )[0] ?? {};

  const pdfUrl = latestV.storage_path
    ? supabase.storage.from("contract-pdfs").getPublicUrl(latestV.storage_path as string).data.publicUrl
    : null;

  const rawFields = document.template_fields as Record<string, unknown> | null;
  const templateFields = rawFields
    ? Object.fromEntries(Object.entries(rawFields).map(([k, v]) => [k, String(v ?? "")]))
    : undefined;

  return {
    id:                 sr.id as string,
    documentId:         sr.document_id as string,
    documentTitle:      (document.title as string) ?? "",
    signerEmail:        sr.signer_email as string,
    signerName:         sr.signer_name as string,
    status:             sr.status as SigningRequest["status"],
    acceptedConformity: (sr.accepted_conformity as boolean) ?? false,
    sha256Hash:         (latestV.sha256_hash as string) ?? "",
    fileName:           (latestV.file_name as string) ?? "",
    pdfUrl,
    finalPdfUrl:        (document.final_pdf_url as string) ?? null,
    sentAt:             sr.sent_at as string,
    expiresAt:          sr.expires_at as string,
    templateId:         (document.template_id as string) ?? undefined,
    templateFields,
  };
}

// ─── User-facing ──────────────────────────────────────────────────────────────

/** Signing requests sent to this email address */
export async function getMySigningRequests(email: string): Promise<SigningRequest[]> {
  const { data, error } = await supabase
    .from("signature_requests")
    .select("*, documents(*, document_versions:document_versions!document_versions_document_id_fkey(*))")
    .eq("signer_email", email)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((sr) => mapRowToSigningRequest(sr as Record<string, unknown>));
}

/** Single signing request by ID */
export async function getSigningRequest(id: string): Promise<SigningRequest | null> {
  const { data, error } = await supabase
    .from("signature_requests")
    .select("*, documents(*, document_versions:document_versions!document_versions_document_id_fkey(*))")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRowToSigningRequest(data as Record<string, unknown>);
}

/** Accept conformity declaration (step 0 → 1 in the signing flow) */
export async function acceptConformity(requestId: string, acceptanceText: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  // Insert conformity acceptance record
  await supabase.from("conformity_acceptances").insert({
    signature_request_id: requestId,
    user_id:              user?.id ?? null,
    acceptance_text:      acceptanceText,
    ip_address:           null,
    user_agent:           navigator.userAgent,
  });

  // Update request status
  await supabase
    .from("signature_requests")
    .update({ status: "CONFORMITY_ACCEPTED", accepted_conformity: true })
    .eq("id", requestId);
}

/**
 * Execute the signature after facial verification + manual signature pad.
 * Inserts into `signatures`, updates the request status, and logs the audit event.
 */
export async function executeSignature(
  requestId: string,
  metadata: Record<string, unknown>
): Promise<SignatureResult> {
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the request to get signer info and document hash
  const request = await getSigningRequest(requestId);
  if (!request) throw new Error("Solicitud de firma no encontrada");

  const signedAt = new Date().toISOString();

  // 1. Insert signature record
  const { data: sig, error: sigError } = await supabase
    .from("signatures")
    .insert({
      signature_request_id: requestId,
      user_id:              user?.id ?? null,
      ip_address:           null,
      user_agent:           navigator.userAgent,
      signed_at:            signedAt,
      signature_method:     "CANVAS",
      signature_data:       (metadata.signatureData as string) ?? null,
    })
    .select()
    .single();

  if (sigError || !sig) throw new Error(sigError?.message ?? "Error al registrar la firma");

  // 2. Update request status to SIGNED
  await supabase
    .from("signature_requests")
    .update({ status: "SIGNED", completed_at: signedAt })
    .eq("id", requestId);

  // 3. Audit log
  await supabase.from("audit_logs").insert({
    user_id:       user?.id ?? null,
    action:        "DOCUMENT_SIGNED",
    entity_type:   "signature_request",
    entity_id:     requestId,
    document_hash: request.sha256Hash ?? null,
    ip_address:    null,
    user_agent:    navigator.userAgent,
    metadata:      { signatureId: sig.id, method: "CANVAS+FACIAL" },
  });

  return {
    signatureId:  sig.id as string,
    documentHash: request.sha256Hash ?? "",
    signedAt,
    signerEmail:  request.signerEmail,
    signerName:   request.signerName,
    ipAddress:    "—",
  };
}

/**
 * Después de que alguien firma, verifica si el documento quedó COMPLETED.
 * Si es así y no tiene PDF consolidado, lo genera y lo sube a Storage.
 * Se llama silenciosamente (no lanza error visible al usuario si falla).
 */
export async function tryGenerateConsolidatedPdf(documentId: string): Promise<void> {
  try {
    // 1. Chequear si el documento está COMPLETED y no tiene PDF aún
    const { data: doc } = await supabase
      .from("documents")
      .select("title, status, final_pdf_url, organization_id")
      .eq("id", documentId)
      .single();

    if (!doc || doc.status !== "COMPLETED" || doc.final_pdf_url) return;

    // 2. Traer todos los signature_requests firmados
    const { data: srs } = await supabase
      .from("signature_requests")
      .select("id, signer_name, signer_email")
      .eq("document_id", documentId)
      .eq("status", "SIGNED");

    if (!srs?.length) return;

    // 3. Traer las firmas (imágenes) de esos requests
    const srIds = srs.map((sr) => sr.id as string);
    const { data: sigs } = await supabase
      .from("signatures")
      .select("signature_request_id, signature_data, signed_at")
      .in("signature_request_id", srIds);

    const signers = srs.map((sr) => {
      const sig = sigs?.find((s) => s.signature_request_id === sr.id);
      return {
        name:          sr.signer_name as string,
        email:         sr.signer_email as string,
        signedAt:      (sig?.signed_at as string) ?? new Date().toISOString(),
        signatureData: (sig?.signature_data as string) ?? null,
      };
    });

    // 4. Generar PDF
    const pdfBlob = await generateSignedPdf(doc.title as string, documentId, signers);

    // 5. Subir a Storage — path: {org_id}/{doc_id}/firmado.pdf
    const orgId = (doc.organization_id as string) ?? "shared";
    const path  = `${orgId}/${documentId}/firmado.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("signed-contracts")
      .upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.warn("[pdf] Error subiendo PDF:", uploadErr.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("signed-contracts").getPublicUrl(path);

    // 6. Guardar URL en el documento
    await supabase
      .from("documents")
      .update({ final_pdf_url: urlData.publicUrl })
      .eq("id", documentId);
  } catch (err) {
    console.warn("[pdf] Error generando PDF consolidado:", err);
  }
}

/** Reject a signing request */
export async function rejectSigning(requestId: string, _reason?: string): Promise<void> {
  await supabase
    .from("signature_requests")
    .update({ status: "REJECTED" })
    .eq("id", requestId);
}
