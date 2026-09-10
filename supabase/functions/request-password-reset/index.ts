/**
 * Supabase Edge Function — request-password-reset
 *
 * Genera el link de recuperación de contraseña con el generador nativo de
 * Supabase Auth (token firmado, expira, un solo uso — no se reimplementa esa
 * parte) pero el EMAIL lo manda esta función por Resend, no el mailer propio
 * de Supabase. Motivo: el mailer nativo de Supabase ya viene dando problemas
 * de límite de envío en este proyecto (ver el mensaje de rate limit en
 * auth.service.ts → register()) — no conviene apoyar recuperación de
 * contraseña en el mismo canal poco confiable.
 *
 * `auth.admin.generateLink` requiere service_role — por eso esto tiene que
 * vivir en una Edge Function, nunca puede llamarse desde el cliente con la
 * anon key.
 *
 * DEPLOY:
 *   supabase functions deploy request-password-reset
 *
 * ENV VARS (mismas que send-signing-email):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, APP_URL, FROM_EMAIL
 *
 * BODY: { "email": "persona@empresa.com" }
 * RESPONSE: siempre { ok: true } — nunca revela si el email existe o no,
 * mismo comportamiento de seguridad que resetPasswordForEmail() de Supabase.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://firma.escencial.com").replace(/\/+$/, "");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@escencial.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function buildEmailHtml(actionLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
    <body style="font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 0;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <div style="background:#18181b;padding:28px 32px;">
          <p style="color:#fff;font-size:18px;font-weight:700;margin:0;">Firma Electrónica · Escencial</p>
        </div>
        <div style="padding:32px;">
          <h2 style="font-size:20px;font-weight:700;color:#18181b;margin:0 0 12px;">
            Recuperar tu contraseña
          </h2>
          <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste vos, hacé clic en el botón de abajo para elegir una nueva.
          </p>
          <a href="${actionLink}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;">
            Elegir nueva contraseña →
          </a>
          <p style="margin-top:24px;color:#a1a1aa;font-size:11px;line-height:1.6;">
            Si no podés hacer clic en el botón, copiá este enlace:<br/>
            <a href="${actionLink}" style="color:#3f3f46;">${actionLink}</a>
          </p>
          <p style="margin-top:16px;color:#a1a1aa;font-size:12px;line-height:1.6;">
            Si no pediste este cambio, podés ignorar este correo — tu contraseña actual sigue funcionando.
          </p>
          <hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0;" />
          <p style="color:#a1a1aa;font-size:11px;margin:0;">
            Escencial Consultora S.A.S. · Firma Electrónica bajo Ley N° 25.506
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const { email } = await req.json() as { email?: string };
    if (!email) return json({ error: "email requerido" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${APP_URL}/reset-password` },
    });

    // No revelar si el email existe o no — mismo comportamiento que
    // resetPasswordForEmail(). Si el usuario no existe, generateLink tira
    // error acá; devolvemos { ok: true } igual y no mandamos nada.
    if (error || !data?.properties?.action_link) {
      console.warn("[request-password-reset] generateLink falló (posible email inexistente):", error?.message);
      return json({ ok: true });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: "🔒 Recuperar tu contraseña — Firma Electrónica",
        html: buildEmailHtml(data.properties.action_link),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    // Ante un error real de infraestructura (no "usuario inexistente") sí devolvemos
    // 500 — un error de Resend/servidor no es información sensible sobre el usuario.
    return json({ ok: false, error: message }, 500);
  }
});
