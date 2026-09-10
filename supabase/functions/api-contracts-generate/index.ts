/**
 * Supabase Edge Function — api-contracts-generate
 *
 * Entry point de la API B2B. Una empresa cliente (ya habilitada por SUPER_ADMIN,
 * ver admin-api-credentials) llama acá para generar un contrato a partir de un
 * modelo habilitado (api_template_bindings), con la firma de su Autoridad
 * pre-cargada. El firmante final recibe el contrato por email y lo firma vía el
 * flujo público (/sign/:token, sin cuenta) — TODAS las veces que se emita ese
 * modelo, no una sola vez.
 *
 * No duplica la lógica de firma: el firmante final firma con sign-document,
 * exactamente igual que cualquier otro documento del sistema. Esta función solo
 * materializa el documento (PDF con el sello de la Autoridad ya horneado) y
 * dispara el mismo email que ya usa el resto del sistema.
 *
 * DEPLOY:
 *   supabase functions deploy api-contracts-generate
 *
 * AUTH: Authorization: Bearer <api secret> — ver supabase/functions/_shared/apiAuth.ts
 *
 * BODY:
 *   {
 *     "templateSlug": "acuerdo-marco",           // api_template_bindings.api_slug
 *     "signerData": { "name": "...", "email": "...", "dni": "...", "cuil": "..." },
 *     "dynamicFields": { "monto": "150000", "fecha_inicio": "2026-10-01" },
 *     "idempotencyKey": "opcional-para-reintentos-seguros"
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateApiRequest } from "../_shared/apiAuth.ts";
import { renderTemplatePdf } from "../_shared/renderTemplatePdf.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://firma.escencial.com").replace(/\/+$/, "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const ctx = await authenticateApiRequest(supabase, req);
    if (!ctx) return json({ error: "Credencial de API inválida o revocada" }, 401);

    const body = await req.json() as {
      templateSlug?: string;
      signerData?: { name?: string; email?: string; dni?: string; cuil?: string };
      dynamicFields?: Record<string, string>;
      idempotencyKey?: string;
    };

    const templateSlug = body.templateSlug?.trim();
    const signer = body.signerData;
    if (!templateSlug || !signer?.email || !signer?.name) {
      return json({ error: "templateSlug, signerData.name y signerData.email son requeridos" }, 400);
    }

    // ── Idempotencia: si ya se generó con esta key, devolver el mismo resultado ──
    if (body.idempotencyKey) {
      const { data: existing } = await supabase
        .from("api_contract_requests")
        .select("status, document_id, signature_request_id")
        .eq("organization_id", ctx.organizationId)
        .eq("idempotency_key", body.idempotencyKey)
        .maybeSingle();

      if (existing?.status === "GENERATED" && existing.signature_request_id) {
        const { data: sr } = await supabase
          .from("signature_requests")
          .select("token, status")
          .eq("id", existing.signature_request_id)
          .maybeSingle();
        if (sr) {
          return json({
            contractId: existing.document_id,
            status: sr.status === "SIGNED" ? "completed" : "pending_client_signature",
            signingUrl: `${APP_URL}/sign/${sr.token}`,
          });
        }
      }
    }

    // ── Template habilitado para esta org ──────────────────────────────────────
    const { data: binding } = await supabase
      .from("api_template_bindings")
      .select("id, is_enabled, contract_templates(id, name, content_html, signature_position)")
      .eq("organization_id", ctx.organizationId)
      .eq("api_slug", templateSlug)
      .maybeSingle();

    const template = binding?.contract_templates as unknown as
      { id: string; name: string; content_html: string; signature_position: unknown } | null;

    if (!binding || !binding.is_enabled || !template) {
      return json({ error: `El modelo "${templateSlug}" no está habilitado para esta organización` }, 404);
    }

    // ── Autoridad Firmante activa (precondición dura, no hay firma delegada sin esto) ──
    const { data: authority } = await supabase
      .from("organization_authorities")
      .select("full_name, email, signature_url")
      .eq("organization_id", ctx.organizationId)
      .eq("type", "PERMANENT")
      .eq("status", "ACTIVE")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!authority) {
      return json({ error: "La organización no tiene una Autoridad Firmante activa. Contactar al SUPER_ADMIN." }, 412);
    }

    // ── owner_id es NOT NULL en documents. La API opera "como" el ORG_ADMIN de la
    //    organización (mismo criterio que el resto del diseño: la empresa cliente
    //    ejerce las mismas acciones de un ORG_ADMIN, solo que por otra interfaz). ──
    const { data: ownerCandidate } = await supabase
      .from("users")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .in("role", ["ORG_ADMIN", "ADMIN"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!ownerCandidate) {
      return json({ error: "La organización no tiene un ORG_ADMIN configurado; no se puede generar el contrato." }, 412);
    }

    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name, logo_light_url, logo_dark_url")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    const orgName = orgRow?.name ?? ctx.organization.name;
    const orgLogo = orgRow?.logo_light_url ?? orgRow?.logo_dark_url ?? null;

    const dynamicFields = body.dynamicFields ?? {};
    const templateFields: Record<string, string> = {
      _templateContent: template.content_html,
      _legalTitle: template.name,
      _dbTemplateId: template.id,
      ...dynamicFields,
      nombre_usuario: signer.name,
      email_usuario: signer.email,
      dni_usuario: signer.dni ?? "",
      cuil_usuario: signer.cuil ?? "",
      autoridad_nombre: authority.full_name,
      autoridad_email: authority.email ?? "",
      autoridad_signature_url: authority.signature_url ?? "",
    };

    // ── Documento + PDF base (con sello de Autoridad horneado) ──────────────────
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        title: template.name,
        description: `Generado vía API — modelo "${templateSlug}"`,
        owner_id: ownerCandidate.id,
        organization_id: ctx.organizationId,
        template_id: template.id,
        template_fields: templateFields,
        signature_position: template.signature_position,
        total_signers: 1,
        status: "SENT",
      })
      .select("id")
      .single();
    if (docError || !doc) throw new Error(docError?.message ?? "Error creando documento");

    const pdfBytes = await renderTemplatePdf({
      title: template.name,
      documentId: doc.id,
      templateFields,
      organizationName: orgName,
      authority: { fullName: authority.full_name, email: authority.email, signatureUrl: authority.signature_url },
    });

    const storagePath = `api/${ctx.organizationId}/${doc.id}_contrato.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("contract-pdfs")
      .upload(storagePath, pdfBytes, { upsert: true, contentType: "application/pdf" });
    if (uploadError) throw new Error(`Error subiendo PDF: ${uploadError.message}`);

    const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBytes);
    const sha256Hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error: verErr } = await supabase.from("document_versions").insert({
      document_id: doc.id,
      version_number: 1,
      file_name: "contrato.pdf",
      storage_path: storagePath,
      sha256_hash: sha256Hash,
      file_size: pdfBytes.byteLength,
    });
    if (verErr) throw new Error(verErr.message);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const token = crypto.randomUUID();
    const { data: sr, error: srError } = await supabase
      .from("signature_requests")
      .insert({
        document_id: doc.id,
        document_title: template.name,
        organization_id: ctx.organizationId,
        organization_name: orgName,
        organization_logo: orgLogo,
        signer_email: signer.email,
        signer_name: signer.name,
        signer_dni: signer.dni ?? null,
        signer_cuil: signer.cuil ?? null,
        status: "PENDING",
        expires_at: expiresAt,
        signing_order: 0,
        token,
      })
      .select("id")
      .single();
    if (srError || !sr) throw new Error(srError?.message ?? "Error creando solicitud de firma");

    // Email al firmante final — mismo template/función que usa el resto del sistema,
    // solo que con publicToken para que el link sea la ruta pública sin cuenta.
    await supabase.functions.invoke("send-signing-email", {
      body: {
        signerEmail: signer.email,
        signerName: signer.name,
        documentTitle: template.name,
        requestId: sr.id,
        publicToken: token,
      },
    }).catch(() => {});

    const signingUrl = `${APP_URL}/sign/${token}`;

    await supabase.from("api_contract_requests").upsert({
      organization_id: ctx.organizationId,
      api_credential_id: ctx.credentialId,
      idempotency_key: body.idempotencyKey ?? null,
      document_id: doc.id,
      signature_request_id: sr.id,
      request_payload: body,
      status: "GENERATED",
    }, { onConflict: "organization_id,idempotency_key" });

    await supabase.from("webhook_events").insert({
      organization_id: ctx.organizationId,
      event_type: "contract.created",
      document_id: doc.id,
      signature_request_id: sr.id,
      payload: { event: "contract.created", contractId: doc.id, status: "pending_client_signature" },
    });
    // Intento inmediato de despacho — si falla, el cron de dispatch-webhook reintenta.
    supabase.functions.invoke("dispatch-webhook", { body: {} }).catch(() => {});

    return json({ contractId: doc.id, status: "pending_client_signature", signingUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json({ error: message }, 500);
  }
});
