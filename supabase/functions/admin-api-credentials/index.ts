/**
 * Supabase Edge Function — admin-api-credentials
 *
 * SUPER_ADMIN only. Genera y revoca credenciales de API por organización, y
 * togglea is_api_enabled. No es self-service: solo SUPER_ADMIN puede llamar
 * esto (ver decisión de producto en memoria de proyecto "API Conector B2B").
 *
 * Sigue el patrón (B) "oficial" ya usado en admin-create-user: cliente anon
 * con el JWT del caller reenviado como header para validar sesión+rol, cliente
 * service_role para el trabajo real.
 *
 * AUTH: Authorization: Bearer <JWT de sesión de SUPER_ADMIN>
 *
 * BODY:
 *   { "action": "enable",  "organizationId": "..." }
 *   { "action": "disable", "organizationId": "..." }
 *   { "action": "generate_credential", "organizationId": "..." }
 *      → { keyId, secret }  el secret se devuelve UNA sola vez, no se puede recuperar después
 *   { "action": "revoke_credential", "credentialId": "..." }
 *   { "action": "set_webhook", "organizationId": "...", "webhookUrl": "..." }
 *      → regenera api_webhook_secret y lo devuelve UNA sola vez
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateApiSecret, generateApiKeyId, sha256Hex } from "../_shared/apiAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ error: "Token inválido" }, 401);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: callerProfile } = await adminClient
      .from("users").select("role").eq("id", caller.id).single();

    if (!callerProfile || callerProfile.role !== "SUPER_ADMIN") {
      return json({ error: "Se requiere rol SUPER_ADMIN" }, 403);
    }

    const body = await req.json() as {
      action: "enable" | "disable" | "generate_credential" | "revoke_credential" | "set_webhook";
      organizationId?: string;
      credentialId?: string;
      webhookUrl?: string;
    };

    switch (body.action) {
      case "enable": {
        if (!body.organizationId) return json({ error: "organizationId requerido" }, 400);
        const { error } = await adminClient
          .from("organizations").update({ is_api_enabled: true }).eq("id", body.organizationId);
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "disable": {
        if (!body.organizationId) return json({ error: "organizationId requerido" }, 400);
        const { error } = await adminClient
          .from("organizations").update({ is_api_enabled: false }).eq("id", body.organizationId);
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "generate_credential": {
        if (!body.organizationId) return json({ error: "organizationId requerido" }, 400);
        const secret = generateApiSecret();
        const keyId = generateApiKeyId();
        const secretHash = await sha256Hex(secret);
        const { error } = await adminClient.from("api_credentials").insert({
          organization_id: body.organizationId,
          key_id: keyId,
          secret_hash: secretHash,
          secret_last4: secret.slice(-4),
          created_by: caller.id,
        });
        if (error) throw new Error(error.message);
        // El secret se muestra una única vez acá — no queda recuperable después.
        return json({ keyId, secret });
      }
      case "revoke_credential": {
        if (!body.credentialId) return json({ error: "credentialId requerido" }, 400);
        const { error } = await adminClient
          .from("api_credentials")
          .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
          .eq("id", body.credentialId);
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "set_webhook": {
        if (!body.organizationId) return json({ error: "organizationId requerido" }, 400);
        const secretBytes = new Uint8Array(32);
        crypto.getRandomValues(secretBytes);
        const webhookSecret = Array.from(secretBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        const { error } = await adminClient
          .from("organizations")
          .update({ api_webhook_url: body.webhookUrl ?? null, api_webhook_secret: webhookSecret })
          .eq("id", body.organizationId);
        if (error) throw new Error(error.message);
        // El secreto HMAC también se muestra una única vez.
        return json({ ok: true, webhookSecret });
      }
      default:
        return json({ error: "action inválida" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json({ ok: false, error: message }, 500);
  }
});
