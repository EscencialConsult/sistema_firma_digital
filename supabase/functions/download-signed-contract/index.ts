import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { documentId } = await req.json() as { documentId?: string };

    if (!documentId) {
      return json({ error: "documentId es requerido" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: document, error } = await supabase
      .from("documents")
      .select("id, status, final_pdf_url")
      .eq("id", documentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!document) {
      return json({ error: "Documento no encontrado" }, 404);
    }

    if (!document.final_pdf_url) {
      return json({ error: "El documento todavia no tiene PDF firmado disponible" }, 404);
    }

    return json({ url: document.final_pdf_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json({ error: message }, 500);
  }
});
