/**
 * Supabase Edge Function — api-contracts-status
 *
 * Lectura de solo consulta para que la empresa cliente sepa en qué estado está
 * un contrato generado por api-contracts-generate. Sin lógica de negocio nueva:
 * lee signature_requests, la misma tabla que ya consultan PublicSigningPage y
 * SigningFlowPage.
 *
 * AUTH: Authorization: Bearer <api secret>
 * GET /api-contracts-status?contractId=<uuid>   (o ?requestId=<uuid>)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateApiRequest } from "../_shared/apiAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const ctx = await authenticateApiRequest(supabase, req);
    if (!ctx) return json({ error: "Credencial de API inválida o revocada" }, 401);

    const url = new URL(req.url);
    const contractId = url.searchParams.get("contractId");
    const requestId = url.searchParams.get("requestId");
    if (!contractId && !requestId) return json({ error: "contractId o requestId requerido" }, 400);

    let query = supabase
      .from("signature_requests")
      .select("id, document_id, status, sent_at, viewed_at, signed_at, expires_at, organization_id")
      .eq("organization_id", ctx.organizationId);

    query = contractId ? query.eq("document_id", contractId) : query.eq("id", requestId as string);

    const { data: sr, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!sr) return json({ error: "Contrato no encontrado para esta organización" }, 404);

    const STATUS_MAP: Record<string, string> = {
      PENDING: "pending_client_signature",
      VIEWED: "pending_client_signature",
      CONFORMITY_ACCEPTED: "pending_client_signature",
      SIGNED: "completed",
      REJECTED: "rejected",
      EXPIRED: "expired",
    };

    return json({
      contractId: sr.document_id,
      requestId: sr.id,
      status: STATUS_MAP[sr.status] ?? sr.status.toLowerCase(),
      sentAt: sr.sent_at,
      viewedAt: sr.viewed_at,
      signedAt: sr.signed_at,
      expiresAt: sr.expires_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json({ error: message }, 500);
  }
});
