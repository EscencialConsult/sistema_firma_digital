/**
 * Supabase Edge Function — send-signing-email
 *
 * Envía el email de notificación al firmante cuando el admin crea un contrato.
 *
 * DEPLOY:
 *   supabase functions deploy send-signing-email
 *
 * ENV VARS requeridas en el Dashboard de Supabase (Settings → Edge Functions):
 *   RESEND_API_KEY  — clave de API de Resend (resend.com)
 *   APP_URL         — URL pública del portal (ej: https://firma.escencial.com)
 *   FROM_EMAIL      — remitente (ej: noreply@escencial.com)
 *
 * LLAMADA DESDE EL FRONTEND:
 *   await supabase.functions.invoke("send-signing-email", {
 *     body: { signerEmail, signerName, documentTitle, requestId }
 *   })
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const APP_URL        = Deno.env.get("APP_URL")        ?? "https://firma.escencial.com";
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL")     ?? "noreply@escencial.com";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")   ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { signerEmail, signerName, documentTitle, requestId, isOtpRequest } = await req.json() as {
      signerEmail:   string;
      signerName:    string;
      documentTitle: string;
      requestId:     string;
      isOtpRequest?: boolean;
    };

    if (!signerEmail || !requestId) {
      return new Response(
        JSON.stringify({ error: "signerEmail y requestId son requeridos" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const nombre = signerName || signerEmail;
    let subject = `📄 Firma requerida: ${documentTitle}`;
    let html = "";

    if (isOtpRequest) {
      // Generate OTP via Database RPC secure definer function
      const { data: otpCode, error: otpError } = await supabase.rpc("generate_otp", {
        p_signature_request_id: requestId,
      });

      if (otpError || !otpCode) {
        throw new Error(otpError?.message ?? "No se pudo generar el código OTP.");
      }

      subject = `🔑 Código de firma: ${documentTitle}`;
      html = `
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
                Tu código de verificación
              </h2>
              <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 8px;">
                Hola <strong>${nombre}</strong>,
              </p>
              <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Estás por firmar el documento <strong>${documentTitle}</strong>. Ingresá el siguiente código de 6 dígitos en la pantalla de firma para completar la operación:
              </p>
              <div style="background:#f4f4f5;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
                <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#18181b;font-family:monospace;display:inline-block;">${otpCode}</span>
              </div>
              <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 24px;">
                Este código es válido por 10 minutos y solo puede utilizarse una vez. Si no iniciaste esta acción, por favor ignora este correo.
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
    } else {
      const signingUrl = `${APP_URL}/signing/${requestId}`;
      html = `
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
                Tenés un documento para firmar
              </h2>
              <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 8px;">
                Hola <strong>${nombre}</strong>,
              </p>
              <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 24px;">
                <strong>Escencial Consultora</strong> requiere tu firma electrónica en el siguiente documento:
              </p>
              <div style="background:#f4f4f5;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <p style="font-size:15px;font-weight:700;color:#18181b;margin:0;">${documentTitle}</p>
              </div>
              <a href="${signingUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;">
                Firmar documento →
              </a>
              <p style="margin-top:24px;color:#a1a1aa;font-size:11px;line-height:1.6;">
                Si no podés hacer clic en el botón, copiá este enlace:<br/>
                <a href="${signingUrl}" style="color:#3f3f46;">${signingUrl}</a>
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

    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      signerEmail,
        subject: subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return new Response(
      JSON.stringify({ ok: true, id: data.id }),
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
