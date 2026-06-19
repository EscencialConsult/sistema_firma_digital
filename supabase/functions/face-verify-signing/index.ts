import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DIDIT_API_KEY       = Deno.env.get("DIDIT_API_KEY") ?? "";
const DIDIT_API_URL       = (Deno.env.get("DIDIT_API_URL") ?? "https://verification.didit.me").replace(/\/+$/, "");
const DIDIT_CALLBACK_URL  = Deno.env.get("DIDIT_CALLBACK_URL") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { requestId } = await req.json() as { requestId: string };
    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "requestId requerido" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Obtener org y su didit_workflow_id a partir del documento del signing request
    const { data: sr } = await supabase
      .from("signature_requests")
      .select("document_id, documents(organization_id, organizations(didit_workflow_id))")
      .eq("id", requestId)
      .single();

    const doc = (sr?.documents as Record<string, unknown>) ?? {};
    const org = (doc?.organizations as Record<string, unknown>) ?? {};
    const workflowId = (org?.didit_workflow_id as string) ?? "";
    const orgId = (doc?.organization_id as string) ?? "";

    if (!workflowId) {
      return new Response(
        JSON.stringify({ error: "La organización no tiene workflow DIDIT configurado" }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Crear registro de verificación vinculado al signing request
    const { data: verification, error: insertError } = await supabase
      .from("identity_verifications")
      .insert({
        user_id:             user.id,
        organization_id:     orgId,
        signing_request_id:  requestId,
        status:              "PENDING",
      })
      .select()
      .single();

    if (insertError || !verification) {
      return new Response(
        JSON.stringify({ error: insertError?.message ?? "No se pudo crear la verificación" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Callback con contexto de firma para que el webhook redirija al flujo correcto
    const callback = DIDIT_CALLBACK_URL
      ? `${DIDIT_CALLBACK_URL}?signing=${encodeURIComponent(requestId)}`
      : undefined;

    const diditRes = await fetch(`${DIDIT_API_URL}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": DIDIT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: user.id,
        metadata:    { verificationId: verification.id, signing_request_id: requestId },
        ...(callback ? { callback } : {}),
      }),
    });

    if (!diditRes.ok) {
      const err = await diditRes.text();
      return new Response(
        JSON.stringify({ error: `Error DIDIT (${diditRes.status}): ${err}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const session = await diditRes.json();

    await supabase
      .from("identity_verifications")
      .update({
        provider:               "didit",
        provider_session_id:    session.session_id,
        provider_session_url:   session.url,
        provider_session_token: session.session_token,
      })
      .eq("id", verification.id);

    return new Response(
      JSON.stringify({ sessionId: session.session_id, url: session.url }),
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
