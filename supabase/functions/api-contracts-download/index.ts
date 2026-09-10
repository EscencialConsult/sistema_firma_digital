/**
 * Supabase Edge Function — api-contracts-download
 *
 * Devuelve una URL firmada temporal al PDF más reciente de un contrato generado
 * por API. Mismo patrón que ya usa PublicSigningPage para el botón de descarga
 * — createSignedUrl sobre el bucket contract-pdfs, sin lógica nueva.
 *
 * AUTH: Authorization: Bearer <api secret>
 * GET /api-contracts-download?contractId=<uuid>
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
    if (!contractId) return json({ error: "contractId requerido" }, 400);

    const { data: doc } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", contractId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!doc) return json({ error: "Contrato no encontrado para esta organización" }, 404);

    const { data: version } = await supabase
      .from("document_versions")
      .select("storage_path, version_number")
      .eq("document_id", contractId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return json({ error: "El contrato no tiene un PDF disponible todavía" }, 404);

    const { data: signed, error } = await supabase.storage
      .from("contract-pdfs")
      .createSignedUrl(version.storage_path, 60 * 10); // 10 minutos
    if (error || !signed) throw new Error(error?.message ?? "No se pudo generar la URL de descarga");

    return json({ downloadUrl: signed.signedUrl, expiresInSeconds: 600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json({ error: message }, 500);
  }
});
