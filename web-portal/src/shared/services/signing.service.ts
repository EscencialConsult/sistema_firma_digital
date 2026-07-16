import { supabase } from "../lib/supabase";
import type { SigningRequest, SignatureResult } from "../types/signing";
import type { SignaturePosition } from "../types/contract";
import { DEFAULT_SIGNATURE_POSITION } from "../types/contract";
import { generateSignedPdf } from "../utils/generateSignedPdf";
import { generateSignedPdfImmediate, type SignerInfo } from "../utils/generateSignedPdfImmediate";

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
  const originalV = [...versions].sort(
    (a, b) => (a.version_number as number) - (b.version_number as number)
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
    documentVersionId:  (sr.document_version_id as string) ?? (latestV.id as string) ?? null,
    documentTitle:      (document.title as string) || (sr.document_title as string) || "",
    signerEmail:        sr.signer_email as string,
    signerName:         sr.signer_name as string,
    status:             sr.status as SigningRequest["status"],
    acceptedConformity: (sr.accepted_conformity as boolean) ?? false,
    sha256Hash:         (latestV.sha256_hash as string) ?? "",
    versionNumber:      (latestV.version_number as number) ?? 1,
    fileName:           (originalV.file_name as string) ?? (latestV.file_name as string) ?? "",
    pdfUrl,
    finalPdfUrl:        (document.final_pdf_url as string) ?? null,
    sentAt:             sr.sent_at as string,
    signedAt:           (sr.signed_at as string) ?? null,
    expiresAt:          sr.expires_at as string,
    templateId:         (document.template_id as string) ?? undefined,
    templateFields,
    // Nombre de la org: lo sacamos de los templateFields del contrato (ya completados al enviar)
    organizationName:   (sr.organization_name as string)
                     ?? (rawFields?.razon_social_consultora as string)
                     ?? (rawFields?.nombre_consultora as string)
                     ?? (rawFields?.nombre_empresa as string)
                     ?? null,
    organizationLogo:   (sr.organization_logo as string) ?? null,
    senderName:         (rawFields?.autoridad_nombre as string) ?? null,
  };
}

// ─── User-facing ──────────────────────────────────────────────────────────────

/** Signing requests sent to this email address */
export async function getMySigningRequests(email: string): Promise<SigningRequest[]> {
  if (!email) return [];

  const { data, error } = await supabase
    .from("signature_requests")
    .select("*, documents(*, document_versions:document_versions!document_versions_document_id_fkey(*))")
    .ilike("signer_email", email)
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

  // Capture client public IP
  let clientIp: string | null = null;
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    if (ipRes.ok) {
      const ipJson = await ipRes.json() as { ip?: string };
      clientIp = ipJson.ip ?? null;
    }
  } catch { /* ignore — non-critical */ }

  // 1. Insert signature record
  const { data: sig, error: sigError } = await supabase
    .from("signatures")
    .insert({
      signature_request_id:     requestId,
      document_id:              request.documentId,
      document_version_id:      request.documentVersionId,
      user_id:                  user?.id ?? null,
      signer_email:             request.signerEmail,
      signer_name:              request.signerName,
      document_hash:            request.sha256Hash || `manual-signature:${requestId}:${signedAt}`,
      ip_address:               clientIp,
      user_agent:               navigator.userAgent,
      signed_at:                signedAt,
      signature_method:         "CANVAS",
      signature_data:           (metadata.signatureData as string) ?? null,
      face_similarity_score:    (metadata.faceSimilarityScore as number) ?? null,
      face_verification_method: "LOCAL_WEBCAM",
      signing_selfie_url:       (metadata.signingSelfiUrl as string) ?? null,
      metadata:                 { signatureType: "CANVAS", faceVerified: true },
    })
    .select()
    .single();

  if (sigError || !sig) throw new Error(sigError?.message ?? "Error al registrar la firma");

  // 2. Update request status to SIGNED
  await supabase
    .from("signature_requests")
    .update({ status: "SIGNED", signed_at: signedAt })
    .eq("id", requestId);

  // 3. Audit log
  await supabase.from("audit_logs").insert({
    user_id:       user?.id ?? null,
    action:        "DOCUMENT_SIGNED",
    entity_type:   "signature_request",
    entity_id:     requestId,
    document_hash: request.sha256Hash ?? null,
    ip_address:    clientIp,
    user_agent:    navigator.userAgent,
    metadata:      { signatureId: sig.id, method: "CANVAS+FACIAL" },
  });

  return {
    signatureId:  sig.id as string,
    documentHash: request.sha256Hash ?? "",
    signedAt,
    signerEmail:  request.signerEmail,
    signerName:   request.signerName,
    ipAddress:    clientIp ?? "—",
  };
}

/**
 * Inicia la verificación facial con DIDIT para el flujo de firma.
 * Crea una sesión DIDIT y devuelve la URL a la que redirigir al usuario.
 * Al terminar, DIDIT redirige a /signing/:id?face_verified=ok|failed
 */
export async function initiateFaceVerificationDIDIT(requestId: string): Promise<{ url: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("face-verify-signing", {
    body: { requestId },
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (error || !data?.url) {
    throw new Error(error?.message ?? "No se pudo iniciar la verificación DIDIT");
  }
  return { url: data.url as string };
}

/**
 * Realiza la verificación facial local enviando la selfie capturada en base64
 * a la Edge Function 'face-verify'.
 */
export async function verifyFaceLocal(
  requestId: string,
  selfieBase64: string
): Promise<{ ok: boolean; similarity: number; verified: boolean; selfieUrl?: string | null; mock?: boolean; noKyc?: boolean; noSelfie?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("face-verify", {
    body: { requestId, selfieBase64 },
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (error) {
    let details = "";
    if (error instanceof Error && "context" in error) {
      try {
        const bodyText = await (error as any).context.text();
        const parsed = JSON.parse(bodyText);
        details = parsed.error || bodyText;
      } catch {
        details = "";
      }
    }
    throw new Error(details || error.message || "Error en la verificación facial");
  }
  return data;
}


/**
 * Después de que alguien firma, verifica si el documento quedó COMPLETED.
 * Si es así y no tiene PDF consolidado, lo genera y lo sube a Storage.
 * Se llama silenciosamente (no lanza error visible al usuario si falla).
 */
export async function generateConsolidatedPdfBlob(documentId: string): Promise<Blob | null> {
  try {
    // 1. Chequear si el documento está COMPLETED y no tiene PDF aún
    const { data: doc } = await supabase
      .from("documents")
      .select("title, status, organization_id, template_id, template_fields, document_versions:document_versions!document_versions_document_id_fkey(*), organization:organizations!organization_id(name)")
      .eq("id", documentId)
      .single();

    if (!doc) return null;

    // 2. Traer todos los signature_requests firmados
    const { data: srs } = await supabase
      .from("signature_requests")
      .select("id, signer_name, signer_email")
      .eq("document_id", documentId)
      .eq("status", "SIGNED");

    if (!srs?.length) return null;

    // 3. Traer las firmas (imágenes) de esos requests
    const srIds = srs.map((sr) => sr.id as string);
    const { data: sigs } = await supabase
      .from("signatures")
      .select("signature_request_id, signature_data, signed_at")
      .in("signature_request_id", srIds);

    const signers: { name: string; email: string; signedAt: string; signatureData: string | null }[] = srs.map((sr) => {
      const sig = sigs?.find((s) => s.signature_request_id === sr.id);
      return {
        name:          sr.signer_name as string,
        email:         sr.signer_email as string,
        signedAt:      (sig?.signed_at as string) ?? new Date().toISOString(),
        signatureData: (sig?.signature_data as string | null) ?? null,
      };
    });

    // 4. Generar PDF
    const rawFields = doc.template_fields as Record<string, unknown> | null;
    const templateFields = rawFields
      ? Object.fromEntries(Object.entries(rawFields).map(([k, v]) => [k, String(v ?? "")]))
      : null;

    // Include authority as a signer if present in template_fields
    const autorNombre = rawFields?.autoridad_nombre as string | undefined;
    const autorSigUrl = rawFields?.autoridad_signature_url as string | undefined;
    const autorEmail  = rawFields?.autoridad_email as string | undefined;
    if (autorNombre && autorSigUrl) {
      let autorSigData: string | null = null;
      try {
        const imgRes = await fetch(autorSigUrl);
        if (imgRes.ok) {
          const imgBlob = await imgRes.blob();
          autorSigData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imgBlob);
          });
        }
      } catch { /* no signature image available */ }
      signers.unshift({
        name:          autorNombre,
        email:         autorEmail ?? "",
        signedAt:      new Date().toISOString(),
        signatureData: autorSigData as string | null,
      });
    }

    const orgRaw = doc.organization as unknown;
    const orgItem = Array.isArray(orgRaw) ? (orgRaw as Array<Record<string, unknown>>)[0] : (orgRaw as Record<string, unknown> | null);
    const organizationName = (orgItem?.name as string) ?? null;

    const versions = (doc.document_versions as Array<Record<string, unknown>>) ?? [];
    const originalVersion = [...versions].sort(
      (a, b) => ((a.version_number as number) ?? 0) - ((b.version_number as number) ?? 0)
    )[0];
    let originalPdf: Blob | null = null;

    if (originalVersion?.storage_path) {
      const { data: originalBlob, error: originalError } = await supabase.storage
        .from("contract-pdfs")
        .download(originalVersion.storage_path as string);

      if (originalError) {
        console.warn("[pdf] No se pudo descargar el PDF original, usando fallback de template:", originalError.message);
      } else {
        originalPdf = originalBlob;
      }
    }

    const pdfBlob = await generateSignedPdf({
      title:          doc.title as string,
      id:             documentId,
      templateId:     (doc.template_id as string) ?? null,
      templateFields,
      originalPdf,
      organizationName,
    }, documentId, signers);

    // 5. Subir a Storage — path: {org_id}/{doc_id}/firmado.pdf
    return pdfBlob;
  } catch (err) {
    console.warn("[pdf] Error generando PDF consolidado:", err);
    return null;
  }
}

export async function tryGenerateConsolidatedPdf(documentId: string): Promise<string | null> {
  try {
    const pdfBlob = await generateConsolidatedPdfBlob(documentId);
    if (!pdfBlob) return null;

    const { data: doc } = await supabase
      .from("documents")
      .select("organization_id")
      .eq("id", documentId)
      .single();

    const orgId = (doc?.organization_id as string) ?? "shared";
    const path = `${orgId}/${documentId}/firmado.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("signed-contracts")
      .upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      console.warn("[pdf] Error subiendo PDF:", uploadErr.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from("signed-contracts").getPublicUrl(path);

    await supabase
      .from("documents")
      .update({ final_pdf_url: urlData.publicUrl })
      .eq("id", documentId);

    return urlData.publicUrl;
  } catch (err) {
    console.warn("[pdf] Error subiendo PDF consolidado:", err);
    return null;
  }
}

/**
 * Immediately embeds all existing signatures into the current PDF version.
 * Called after each user signs, so the PDF always reflects all signatures so far.
 * Uploads the result as a new document version.
 */
export async function generatePerSignerSignedPdf(documentId: string): Promise<string | null> {
  try {
    // 1. Get document with versions and signature position
    const { data: doc } = await supabase
      .from("documents")
      .select("title, signature_position, document_versions:document_versions!document_versions_document_id_fkey(*)")
      .eq("id", documentId)
      .single();

    if (!doc) return null;

    const versions = (doc.document_versions as Array<Record<string, unknown>>) ?? [];
    const latestV = [...versions].sort(
      (a, b) => ((b.version_number as number) ?? 0) - ((a.version_number as number) ?? 0)
    )[0];

    const originalV = [...versions].sort(
      (a, b) => ((a.version_number as number) ?? 0) - ((b.version_number as number) ?? 0)
    )[0];

    if (!originalV?.storage_path) return null;

    // 2. Download original PDF (clean version without signatures)
    const { data: pdfBlob, error: dlErr } = await supabase.storage
      .from("contract-pdfs")
      .download(originalV.storage_path as string);

    if (dlErr || !pdfBlob) return null;

    // 3. Get all SIGNED requests for this document
    const { data: srs } = await supabase
      .from("signature_requests")
      .select("id, signer_name, signer_email")
      .eq("document_id", documentId)
      .eq("status", "SIGNED");

    if (!srs?.length) return null;

    // 4. Get signature images for those requests
    const srIds = srs.map((sr) => sr.id as string);
    const { data: sigs } = await supabase
      .from("signatures")
      .select("signature_request_id, signature_data, signed_at")
      .in("signature_request_id", srIds);

    const signers: SignerInfo[] = srs.map((sr) => {
      const sig = sigs?.find((s) => s.signature_request_id === sr.id);
      return {
        name: sr.signer_name as string,
        email: sr.signer_email as string,
        signedAt: (sig?.signed_at as string) ?? new Date().toISOString(),
        signatureData: (sig?.signature_data as string) ?? null,
      };
    });

    // 5. Generate PDF with embedded signatures
    const pos = (doc.signature_position as SignaturePosition) ?? DEFAULT_SIGNATURE_POSITION;
    const pdfWithSigs = await generateSignedPdfImmediate(pdfBlob, signers, pos);

    // 6. Upload as new version
    const versionNum = (latestV.version_number as number) + 1;
    const safeName = (latestV.file_name as string).replace(/[^\w.\- ]+/g, "_");
    const storagePath = `${documentId}/signed_v${versionNum}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("contract-pdfs")
      .upload(storagePath, pdfWithSigs, { contentType: "application/pdf", upsert: true });

    if (uploadErr) return null;

    // 7. Create new document_versions record
    const hashBuffer = await crypto.subtle.digest("SHA-256", await pdfWithSigs.arrayBuffer());
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    await supabase.from("document_versions").insert({
      document_id:    documentId,
      version_number: versionNum,
      file_name:      `firmado_v${versionNum}.pdf`,
      storage_path:   storagePath,
      sha256_hash:    hashHex,
      file_size:      pdfWithSigs.size,
    });

    return storagePath;
  } catch (err) {
    console.warn("[pdf] Error generando PDF con firmas inmediatas:", err);
    return null;
  }
}

/** Fetch the stored signature image for a completed request (used in the "already signed" view) */
export async function getMySignatureDataForRequest(requestId: string): Promise<{ signatureData: string | null; ipAddress: string | null; faceSimilarityScore: number | null; signedAt: string | null; documentHash: string | null; signingSelfiUrl: string | null }> {
  const { data } = await supabase
    .from("signatures")
    .select("signature_data, ip_address, face_similarity_score, signed_at, document_hash, signing_selfie_url")
    .eq("signature_request_id", requestId)
    .maybeSingle();
  return {
    signatureData:      (data?.signature_data as string) ?? null,
    ipAddress:          (data?.ip_address as string) ?? null,
    faceSimilarityScore:(data?.face_similarity_score as number) ?? null,
    signedAt:           (data?.signed_at as string) ?? null,
    documentHash:       (data?.document_hash as string) ?? null,
    signingSelfiUrl:    (data?.signing_selfie_url as string) ?? null,
  };
}

/** Reject a signing request */
export async function rejectSigning(requestId: string, _reason?: string): Promise<void> {
  await supabase
    .from("signature_requests")
    .update({ status: "REJECTED" })
    .eq("id", requestId);
}
