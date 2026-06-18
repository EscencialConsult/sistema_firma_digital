import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DIDIT_API_KEY = Deno.env.get("DIDIT_API_KEY") ?? "";
const DIDIT_API_URL = (Deno.env.get("DIDIT_API_URL") ?? "https://verification.didit.me").replace(/\/+$/, "");
const DIDIT_WORKFLOW_ID = Deno.env.get("DIDIT_WORKFLOW_ID") ?? "";
const DIDIT_CALLBACK_URL = Deno.env.get("DIDIT_CALLBACK_URL") ?? "";

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

    if (!DIDIT_WORKFLOW_ID) {
      return new Response(
        JSON.stringify({ error: "DIDIT_WORKFLOW_ID no configurado. Creá un workflow en Didit Console primero." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    let { data: verification } = await supabase
      .from("identity_verifications")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["PENDING", "IN_REVIEW"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!verification) {
      const { data: newVer, error: insertError } = await supabase
        .from("identity_verifications")
        .insert({ user_id: user.id, status: "PENDING" })
        .select()
        .single();
      if (insertError || !newVer) {
        return new Response(
          JSON.stringify({ error: "INSERT_ERROR", message: insertError?.message ?? "No se pudo crear la verificación" }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      verification = newVer;
    }

    const diditRes = await fetch(`${DIDIT_API_URL}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": DIDIT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: user.id,
        metadata: { verificationId: verification.id },
        ...(DIDIT_CALLBACK_URL ? { callback: DIDIT_CALLBACK_URL } : {}),
      }),
    });

    if (!diditRes.ok) {
      const err = await diditRes.text();
      return new Response(
        JSON.stringify({ error: "DIDIT_API_ERROR", message: `Error Didit (${diditRes.status}): ${err}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const session = await diditRes.json();

    const { error: updateError } = await supabase
      .from("identity_verifications")
      .update({
        provider: "didit",
        provider_session_id: session.session_id,
        provider_session_url: session.url,
        provider_session_token: session.session_token,
      })
      .eq("id", verification.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "UPDATE_ERROR", message: updateError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        sessionId: session.session_id,
        url: session.url,
        token: session.session_token,
      }),
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
