/**
 * Supabase Edge Function — dispatch-webhook
 *
 * Procesa un lote de webhook_events PENDING due (next_attempt_at <= now()),
 * firma cada payload con HMAC-SHA256 (mismo esquema que kyc-webhook, pero acá
 * nosotros jugamos el rol de emisor) y hace POST al api_webhook_url de la
 * organización. Reintenta con backoff exponencial hasta max_attempts.
 *
 * Se invoca de dos formas (doble capa, sin pg_cron/pg_net como única vía):
 *  1. Fire-and-forget inmediato desde api-contracts-generate al crear el evento.
 *  2. pg_cron cada minuto (ver migración 20260903007) — red de seguridad para
 *     reintentos, y único mecanismo si el intento inmediato falla (ej. la
 *     empresa cliente tenía su endpoint caído en ese momento).
 *
 * Protegida con x-internal-secret — no está pensada para ser llamada por
 * terceros, solo por el propio backend (cron o fire-and-forget interno).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signWebhookPayload } from "../_shared/apiAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DISPATCH_INTERNAL_SECRET = Deno.env.get("DISPATCH_INTERNAL_SECRET") ?? "";
const BATCH_SIZE = 25;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function backoffMinutes(attempts: number): number {
  return Math.min(2 ** attempts, 60); // tope de 1h entre reintentos
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  // El fire-and-forget interno (api-contracts-generate) no manda el secret —
  // solo lo exige el cron externo. Si DISPATCH_INTERNAL_SECRET no está seteado
  // (desarrollo local), no se exige. En hosted, configurarlo y exigirlo siempre.
  if (DISPATCH_INTERNAL_SECRET) {
    const provided = req.headers.get("x-internal-secret") ?? "";
    if (provided !== DISPATCH_INTERNAL_SECRET) return json({ error: "No autorizado" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: due } = await supabase
      .from("webhook_events")
      .select("id, organization_id, payload, attempts, max_attempts, organizations(api_webhook_url, api_webhook_secret)")
      .eq("status", "PENDING")
      .lte("next_attempt_at", new Date().toISOString())
      .limit(BATCH_SIZE);

    let delivered = 0, failed = 0, dead = 0;

    for (const event of due ?? []) {
      const org = event.organizations as unknown as { api_webhook_url: string | null; api_webhook_secret: string | null } | null;

      if (!org?.api_webhook_url || !org.api_webhook_secret) {
        // Sin webhook configurado — no es un error de entrega, es config faltante.
        // Se marca DEAD para no reintentar indefinidamente algo que nunca va a andar.
        await supabase.from("webhook_events").update({ status: "DEAD", last_error: "Organización sin api_webhook_url/secret configurado" }).eq("id", event.id);
        dead++;
        continue;
      }

      const canonicalBody = JSON.stringify(event.payload);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signWebhookPayload(org.api_webhook_secret, canonicalBody, timestamp);

      try {
        const res = await fetch(org.api_webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-signature": signature,
            "x-timestamp": String(timestamp),
          },
          body: canonicalBody,
        });

        if (res.ok) {
          await supabase.from("webhook_events").update({
            status: "DELIVERED", delivered_at: new Date().toISOString(), attempts: event.attempts + 1,
          }).eq("id", event.id);
          delivered++;
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        const attempts = event.attempts + 1;
        const isDead = attempts >= event.max_attempts;
        await supabase.from("webhook_events").update({
          status: isDead ? "DEAD" : "PENDING",
          attempts,
          last_error: err instanceof Error ? err.message : "Error de red",
          next_attempt_at: new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
        }).eq("id", event.id);
        if (isDead) dead++; else failed++;
      }
    }

    return json({ processed: (due ?? []).length, delivered, failed, dead });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json({ error: message }, 500);
  }
});
