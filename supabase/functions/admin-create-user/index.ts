import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")             ?? "";
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")        ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
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

    // Patrón oficial Supabase: pasar el JWT del usuario como header al crear el client
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Leer perfil del caller para obtener su rol y organization_id
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: callerProfile } = await adminClient
      .from("users")
      .select("role, organization_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["SUPER_ADMIN", "ORG_ADMIN"].includes(callerProfile.role)) {
      return new Response(
        JSON.stringify({ error: "Se requiere rol SUPER_ADMIN u ORG_ADMIN" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as {
      fullName: string;
      email:    string;
      password: string;
      role?:    "USER" | "ADMIN" | "ORG_ADMIN" | "SUPER_ADMIN";
      organization_id?: string;
    };

    const { fullName, email, password, role } = body;

    if (!fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: "fullName, email y password son requeridos" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    let targetOrgId: string | null = null;
    if (callerProfile.role === "SUPER_ADMIN") {
      targetOrgId = body.organization_id || null;
    } else if (callerProfile.role === "ORG_ADMIN") {
      targetOrgId = callerProfile.organization_id;
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name: fullName,
        organization_id: targetOrgId
      },
    });

    if (createError || !newUser.user) {
      throw new Error(createError?.message ?? "No se pudo crear el usuario");
    }

    // Actualizamos el rol (ya que el trigger base asigna USER por defecto)
    await adminClient
      .from("users")
      .update({ 
        full_name: fullName, 
        role: role ?? "USER",
        organization_id: targetOrgId 
      })
      .eq("id", newUser.user.id);

    const { data: profile } = await adminClient
      .from("users")
      .select("id, email, full_name, role, verification_status, certificate_status, created_at")
      .eq("id", newUser.user.id)
      .single();

    return new Response(
      JSON.stringify({ ok: true, user: profile }),
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
