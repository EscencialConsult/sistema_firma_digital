/**
 * Supabase Edge Function — admin-create-user
 *
 * Crea un usuario desde el panel admin usando la service_role key.
 * El service_role key NUNCA va al frontend — solo existe en el servidor.
 *
 * DEPLOY:
 *   supabase functions deploy admin-create-user
 *
 * ENV VARS: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son inyectadas automáticamente.
 *
 * Seguridad: solo puede ser llamada por admins (validamos el JWT del caller).
 *
 * REQUEST body:
 *   { fullName: string, email: string, password: string, role: "USER" | "ADMIN" }
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")             ?? "";
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
    // Verificar que el caller es un admin usando su JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace("Bearer ", "").trim();
    if (!callerToken) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Validar el caller con su propio token (no service role)
    const callerClient = createClient(SUPABASE_URL, callerToken);
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Verificar rol ADMIN del caller
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: callerProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "ADMIN") {
      return new Response(
        JSON.stringify({ error: "Se requiere rol ADMIN" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Parsear body
    const { fullName, email, password, role } = await req.json() as {
      fullName: string;
      email:    string;
      password: string;
      role:     "USER" | "ADMIN";
    };

    if (!fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: "fullName, email y password son requeridos" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Crear usuario en Supabase Auth (service role — puede crear sin confirmación de email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !newUser.user) {
      throw new Error(createError?.message ?? "No se pudo crear el usuario");
    }

    // Actualizar perfil (trigger fn_handle_new_user ya lo crea, nosotros actualizamos role + nombre)
    await adminClient
      .from("users")
      .update({ full_name: fullName, role: role ?? "USER" })
      .eq("id", newUser.user.id);

    // Leer perfil completo para devolverlo al frontend
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
