import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY") ?? "";
const DIDIT_API_URL = (Deno.env.get("DIDIT_API_URL") ?? "https://verification.didit.me").replace(/\/+$/, "");
const DIDIT_WEBHOOK_SECRET = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";
const KYC_AUTO_APPROVE_THRESHOLD = Number(Deno.env.get("KYC_AUTO_APPROVE_THRESHOLD") ?? 80);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, shortenFloats(v)])
    );
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>).sort().reduce((acc, key) => {
      acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

function verifySignature(body: Record<string, unknown>, headers: Headers): boolean {
  const secret = DIDIT_WEBHOOK_SECRET;
  if (!secret) return true;

  const timestamp = Number(headers.get("x-timestamp") ?? 0);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const sigV2 = headers.get("x-signature-v2");
  if (sigV2) {
    const canonical = JSON.stringify(sortKeys(shortenFloats(body)));
    const expected = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (timingSafeEqual(expected, sigV2)) return true;
  }

  const sigSimple = headers.get("x-signature-simple");
  if (sigSimple) {
    const canonical = [body.timestamp ?? "", body.session_id ?? "", body.status ?? "", body.webhook_type ?? ""].join(":");
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");
    if (timingSafeEqual(expected, sigSimple)) return true;
  }

  return false;
}

async function saveDiditImage(
  supabase: any,
  imageUrl: string,
  verificationId: string,
  userId: string,
  orgId: string,
  type: "DOCUMENT_FRONT" | "DOCUMENT_BACK" | "SELFIE",
  fileName: string
) {
  try {
    console.log(`[saveDiditImage] Downloading ${type} from ${imageUrl}...`);
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error(`[saveDiditImage] Failed to download image from ${imageUrl}: ${res.statusText}`);
      return;
    }
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const fileSize = arrayBuffer.byteLength;

    const ext = contentType.split("/")[1] || "jpg";
    const storagePath = `${orgId}/${userId}/${verificationId}/${type.toLowerCase()}.${ext}`;

    console.log(`[saveDiditImage] Uploading ${type} to Supabase Storage at kyc-documents/${storagePath}...`);
    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[saveDiditImage] Failed to upload ${type} to storage:`, uploadError);
      return;
    }

    console.log(`[saveDiditImage] Upserting record in identity_documents table for ${type}...`);
    const { error: dbError } = await supabase
      .from("identity_documents")
      .upsert({
        verification_id: verificationId,
        type,
        file_name: fileName,
        mime_type: contentType,
        file_size: fileSize,
        storage_path: storagePath,
      }, { onConflict: "verification_id,type" });

    if (dbError) {
      console.error(`[saveDiditImage] Failed to upsert ${type} in database:`, dbError);
    } else {
      console.log(`[saveDiditImage] Successfully saved ${type} image.`);
    }
  } catch (error) {
    console.error(`[saveDiditImage] Error saving ${type} image from DIDIT:`, error);
  }
}

const FRONTEND_URL = (Deno.env.get("FRONTEND_URL") ?? Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // ── GET: Didit redirige al browser acá con los resultados ─────────────────
  // Necesitamos actualizar la DB para que el frontend (polling/Realtime) detecte
  // el cambio, porque el POST callback de Didit no siempre llega (entorno local).
  if (req.method === "GET") {
    const url = new URL(req.url);
    const status    = url.searchParams.get("status") ?? "";
    const signingId = url.searchParams.get("signing") ?? "";
    const sessionId = url.searchParams.get("session_id") ?? url.searchParams.get("sessionId") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (sessionId && !signingId && (status === "Approved" || status === "Declined" || status === "Abandoned")) {
      const { data: verification } = await supabase
        .from("identity_verifications")
        .select("id, status")
        .eq("provider_session_id", sessionId)
        .maybeSingle();

      // Solo actualizar si el POST handler todavía no lo procesó (status sigue PENDING)
      if (verification && verification.status === "PENDING") {
        const newStatus = status === "Approved" ? "VERIFIED" : "REJECTED";
        await supabase
          .from("identity_verifications")
          .update({ status: newStatus, submitted_at: new Date().toISOString() })
          .eq("id", verification.id);
      }
    }

    let base = FRONTEND_URL || "https://faquqlnwniinqqfmonbv.supabase.co";
    if (base && !base.startsWith("http")) {
      base = `https://${base}`;
    }

    if (signingId) {
      let destination: string;
      if (status === "Approved") {
        destination = `${base}/signing/${signingId}?face_verified=ok`;
      } else if (status === "Declined" || status === "Abandoned") {
        destination = `${base}/signing/${signingId}?face_verified=failed`;
      } else {
        destination = `${base}/signing/${signingId}?face_verified=pending`;
      }
      return new Response(null, {
        status: 302,
        headers: { ...CORS_HEADERS, Location: destination },
      });
    }

    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    if (!verifySignature(body, req.headers)) {
      return new Response(
        JSON.stringify({ error: "Firma de webhook inválida" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const sessionId = (body.session_id ?? (body.session as Record<string, unknown> | undefined)?.id) as string | undefined;
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "session_id requerido" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { data: verification } = await supabase
      .from("identity_verifications")
      .select("*, user:users!user_id(organization_id)")
      .eq("provider_session_id", sessionId)
      .maybeSingle();

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "Verificación no encontrada para esta sesión" }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const decisionRes = await fetch(`${DIDIT_API_URL}/v3/session/${sessionId}/decision/`, {
      headers: { "x-api-key": DIDIT_API_KEY },
    });

    if (decisionRes.status === 404) {
      await supabase
        .from("identity_verifications")
        .update({ status: "EXPIRED" })
        .eq("id", verification.id);

      await supabase.from("audit_logs").insert({
        user_id: verification.user_id,
        action: "KYC_EXPIRED",
        entity_type: "identity_verification",
        entity_id: verification.id,
        metadata: { provider: "didit", reason: "provider_session_not_found" },
      });

      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!decisionRes.ok) {
      const err = await decisionRes.text();
      return new Response(
        JSON.stringify({ error: `Error consultando Didit decision: ${err}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const decision = await decisionRes.json();

    await supabase
      .from("identity_verifications")
      .update({ provider_response: decision })
      .eq("id", verification.id);

    // Guardar fotos de DNI y Selfie si están disponibles
    try {
      const userObj = verification.user as { organization_id?: string | null } | undefined;
      const orgId = userObj?.organization_id || "default";
      const userId = verification.user_id;
      const verificationId = verification.id;

      const idVer = decision.id_verifications?.[0];
      const frontImage = idVer?.full_front_image;
      const backImage = idVer?.full_back_image;
      const selfieImage = decision.liveness_checks?.[0]?.reference_image;

      const imagePromises = [];
      if (frontImage) {
        imagePromises.push(
          saveDiditImage(
            supabase,
            frontImage,
            verificationId,
            userId,
            orgId,
            "DOCUMENT_FRONT",
            "document_front.jpg"
          )
        );
      }
      if (backImage) {
        imagePromises.push(
          saveDiditImage(
            supabase,
            backImage,
            verificationId,
            userId,
            orgId,
            "DOCUMENT_BACK",
            "document_back.jpg"
          )
        );
      }
      if (selfieImage) {
        imagePromises.push(
          saveDiditImage(
            supabase,
            selfieImage,
            verificationId,
            userId,
            orgId,
            "SELFIE",
            "selfie.jpg"
          )
        );
      }

      if (imagePromises.length > 0) {
        console.log(`[kyc-webhook] Processing ${imagePromises.length} image downloads from DIDIT...`);
        await Promise.all(imagePromises);
      }
    } catch (err) {
      console.error("[kyc-webhook] Error processing images:", err);
    }

    const STATUS_MAP: Record<string, string> = {
      Approved: "approved",
      Declined: "declined",
      "In Review": "pending_review",
      Expired: "declined",
      Abandoned: "declined",
      "Kyc Expired": "declined",
    };

    const mappedStatus = STATUS_MAP[decision.status as string] ?? "pending_review";

    if (mappedStatus === "approved") {
      const idVer = decision.id_verifications?.[0];
      const faceMatch = decision.face_matches?.[0];
      const score = faceMatch?.score ?? decision.liveness_checks?.[0]?.score ?? 0;

      const updateFields: Record<string, unknown> = {
        status: score >= KYC_AUTO_APPROVE_THRESHOLD ? "VERIFIED" : "IN_REVIEW",
        submitted_at: new Date().toISOString(),
      };

      // No pisar datos que el usuario ya cargó en Step 0 si Didit no los devuelve
      if (idVer?.full_name != null) updateFields.full_name = idVer.full_name;
      if (idVer?.document_number != null) updateFields.document_number = idVer.document_number;

      await supabase
        .from("identity_verifications")
        .update(updateFields)
        .eq("id", verification.id);

      await supabase.from("audit_logs").insert({
        user_id: verification.user_id,
        action: score >= KYC_AUTO_APPROVE_THRESHOLD ? "KYC_APPROVED" : "KYC_SUBMITTED",
        entity_type: "identity_verification",
        entity_id: verification.id,
        metadata: {
          provider: "didit",
          score,
          autoApproved: score >= KYC_AUTO_APPROVE_THRESHOLD,
          reason: score >= KYC_AUTO_APPROVE_THRESHOLD ? null : "score_below_threshold",
        },
      });
    } else if (mappedStatus === "pending_review") {
      await supabase
        .from("identity_verifications")
        .update({ status: "IN_REVIEW", submitted_at: new Date().toISOString() })
        .eq("id", verification.id);

      await supabase.from("audit_logs").insert({
        user_id: verification.user_id,
        action: "KYC_SUBMITTED",
        entity_type: "identity_verification",
        entity_id: verification.id,
        metadata: { provider: "didit", autoApproved: false, reason: "provider_pending_review" },
      });
    } else if (mappedStatus === "declined") {
      await supabase
        .from("identity_verifications")
        .update({ status: "REJECTED" })
        .eq("id", verification.id);

      await supabase.from("audit_logs").insert({
        user_id: verification.user_id,
        action: "KYC_REJECTED",
        entity_type: "identity_verification",
        entity_id: verification.id,
        metadata: { provider: "didit" },
      });
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
