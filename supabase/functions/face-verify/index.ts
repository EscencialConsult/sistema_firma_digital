/**
 * Supabase Edge Function — face-verify
 *
 * Compara la selfie capturada durante el flujo de firma contra la foto KYC del usuario.
 * Usa AWS Rekognition CompareFaces.
 *
 * DEPLOY:
 *   supabase functions deploy face-verify
 *
 * ENV VARS requeridas (Settings → Edge Functions en Supabase Dashboard):
 *   AWS_ACCESS_KEY_ID     — clave de acceso AWS (IAM con permiso rekognition:CompareFaces)
 *   AWS_SECRET_ACCESS_KEY — clave secreta AWS
 *   AWS_REGION            — región (ej: us-east-1)
 *   SUPABASE_URL          — ya inyectada automáticamente por Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — ya inyectada automáticamente por Supabase
 *
 * REQUEST:
 *   POST body: { requestId: string, selfieBase64: string }
 *   - requestId: ID de la signature_request (para buscar la foto KYC del firmante)
 *   - selfieBase64: imagen JPEG capturada por webcam, sin prefijo data:...base64,
 *
 * RESPONSE:
 *   { ok: true, similarity: number, verified: boolean }
 *   { ok: false, error: string }
 */

import { serve }       from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AWS_ACCESS_KEY_ID     = Deno.env.get("AWS_ACCESS_KEY_ID")     ?? "";
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "";
const AWS_REGION            = Deno.env.get("AWS_REGION")            ?? "us-east-1";
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")          ?? "";
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SIMILARITY_THRESHOLD = 90;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── AWS Signature v4 (minimal, for Rekognition) ──────────────────────────────

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate    = await hmacSha256(new TextEncoder().encode("AWS4" + secretKey), dateStamp);
  const kRegion  = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes  = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function signedRekognitionRequest(
  body: string,
  action: string
): Promise<Response> {
  const service = "rekognition";
  const host    = `${service}.${AWS_REGION}.amazonaws.com`;
  const now     = new Date();

  const amzDate  = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:RekognitionService.${action}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSigningKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(stringToSign)
  );
  const signature = Array.from(new Uint8Array(signatureBytes)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      "Content-Type":    "application/x-amz-json-1.1",
      "X-Amz-Date":     amzDate,
      "X-Amz-Target":   `RekognitionService.${action}`,
      "Authorization":  authorization,
      "Host":           host,
    },
    body,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function uploadSigningSelfie(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  selfieBase64: string,
): Promise<string | null> {
  try {
    const bytes = base64ToUint8Array(selfieBase64);
    const path  = `signing-selfies/${requestId}.jpg`;
    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) { console.warn("[face-verify] selfie upload error:", error.message); return null; }
    const { data } = supabase.storage.from("kyc-documents").getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch (e) {
    console.warn("[face-verify] selfie upload exception:", e);
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { requestId, selfieBase64 } = await req.json() as {
      requestId:    string;
      selfieBase64: string;
    };

    if (!requestId || !selfieBase64) {
      return new Response(
        JSON.stringify({ ok: false, error: "requestId y selfieBase64 son requeridos" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Buscar foto KYC del firmante via Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Si no hay credenciales AWS, devolver mock aprobado (modo desarrollo)
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.warn("[face-verify] Sin credenciales AWS — modo mock activado");
      const selfieUrl = await uploadSigningSelfie(supabase, requestId, selfieBase64);
      return new Response(
        JSON.stringify({ ok: true, similarity: 96.4, verified: true, mock: true, selfieUrl }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { data: sr } = await supabase
      .from("signature_requests")
      .select("signer_email")
      .eq("id", requestId)
      .single();

    if (!sr?.signer_email) {
      throw new Error("No se encontró la solicitud de firma");
    }

    // 1. Obtener el user_id a partir del email del firmante
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("email", sr.signer_email)
      .maybeSingle();

    if (!userRow) {
      throw new Error("No se encontró el usuario firmante en el sistema");
    }

    // 2. Buscar la última verificación de identidad del usuario
    const { data: verif } = await supabase
      .from("identity_verifications")
      .select("id")
      .eq("user_id", userRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!verif) {
      // Sin verificación KYC → aprobar de todas formas (usuario sin KYC)
      const selfieUrl = await uploadSigningSelfie(supabase, requestId, selfieBase64);
      return new Response(
        JSON.stringify({ ok: true, similarity: 0, verified: true, noKyc: true, selfieUrl }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // 3. Buscar la selfie en identity_documents
    const { data: doc } = await supabase
      .from("identity_documents")
      .select("storage_path")
      .eq("verification_id", verif.id)
      .eq("type", "SELFIE")
      .maybeSingle();

    if (!doc?.storage_path) {
      // Sin foto selfie KYC → aprobar de todas formas
      const selfieUrl = await uploadSigningSelfie(supabase, requestId, selfieBase64);
      return new Response(
        JSON.stringify({ ok: true, similarity: 0, verified: true, noSelfie: true, selfieUrl }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Descargar foto KYC desde storage
    let { data: kycBlob, error: downloadError } = await supabase.storage
      .from("kyc-documents")
      .download(doc.storage_path);

    if (downloadError || !kycBlob) {
      console.warn("[face-verify] kyc-documents download failed, trying identity-documents fallback...", downloadError);
      const { data: fallbackBlob, error: fallbackError } = await supabase.storage
        .from("identity-documents")
        .download(doc.storage_path);

      if (fallbackError || !fallbackBlob) {
        console.error("[face-verify] Storage download error:", downloadError || fallbackError);
        throw new Error(`No se pudo descargar la foto KYC: ${downloadError?.message || fallbackError?.message}`);
      }
      kycBlob = fallbackBlob;
    }

    const kycArrayBuffer = await kycBlob.arrayBuffer();
    const kycBase64 = bytesToBase64(new Uint8Array(kycArrayBuffer));

    // Llamar a Rekognition CompareFaces
    const payload = JSON.stringify({
      SimilarityThreshold: SIMILARITY_THRESHOLD,
      SourceImage: { Bytes: selfieBase64 },   // selfie capturada ahora
      TargetImage: { Bytes: kycBase64 },       // foto KYC registrada
    });

    const rekRes = await signedRekognitionRequest(payload, "CompareFaces");

    if (!rekRes.ok) {
      const errText = await rekRes.text();
      throw new Error(`Rekognition error ${rekRes.status}: ${errText}`);
    }

    const rekData = await rekRes.json() as {
      FaceMatches?: Array<{ Similarity: number }>;
    };

    const similarity = rekData.FaceMatches?.[0]?.Similarity ?? 0;
    const verified   = similarity >= SIMILARITY_THRESHOLD;

    // Guardar selfie solo si la verificación fue exitosa
    const selfieUrl = verified
      ? await uploadSigningSelfie(supabase, requestId, selfieBase64)
      : null;

    return new Response(
      JSON.stringify({ ok: true, similarity: parseFloat(similarity.toFixed(1)), verified, selfieUrl }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
