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

    // Si no hay credenciales AWS, devolver mock aprobado (modo desarrollo)
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.warn("[face-verify] Sin credenciales AWS — modo mock activado");
      return new Response(
        JSON.stringify({ ok: true, similarity: 96.4, verified: true, mock: true }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Buscar foto KYC del firmante via Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: sr } = await supabase
      .from("signature_requests")
      .select("signer_email")
      .eq("id", requestId)
      .single();

    if (!sr?.signer_email) {
      throw new Error("No se encontró la solicitud de firma");
    }

    const { data: iv } = await supabase
      .from("identity_verifications")
      .select("selfie_path")
      .eq("email", sr.signer_email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!iv?.selfie_path) {
      // Sin foto KYC → aprobar de todas formas (usuario sin KYC)
      return new Response(
        JSON.stringify({ ok: true, similarity: 0, verified: true, noKyc: true }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Descargar foto KYC desde storage
    const { data: kycBlob } = await supabase.storage
      .from("kyc-documents")
      .download(iv.selfie_path);

    if (!kycBlob) throw new Error("No se pudo descargar la foto KYC");

    const kycArrayBuffer = await kycBlob.arrayBuffer();
    const kycBase64 = btoa(String.fromCharCode(...new Uint8Array(kycArrayBuffer)));

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

    return new Response(
      JSON.stringify({ ok: true, similarity: parseFloat(similarity.toFixed(1)), verified }),
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
