import { supabase } from "../lib/supabase";
import { DEFAULT_SIGNATURE_POSITION, type SignaturePosition } from "../types/contract";

export interface DbContractTemplate {
  id:               string;
  organizationId:   string;
  name:             string;
  description:      string;
  label:            string;
  logoHeader:       boolean;
  logoWatermark:    boolean;
  contentHtml:      string;
  signaturePosition: SignaturePosition;
  versionMinor:     number;
  templateType:     "html" | "pdf";
  pdfStoragePath:   string | null;
  createdAt:        string;
  updatedAt:        string;
}

function mapRow(r: Record<string, unknown>): DbContractTemplate {
  return {
    id:               r.id as string,
    organizationId:   r.organization_id as string,
    name:             r.name as string,
    description:      (r.description as string) ?? "",
    label:            (r.label as string) ?? "",
    logoHeader:       (r.logo_header as boolean) ?? false,
    logoWatermark:    (r.logo_watermark as boolean) ?? false,
    contentHtml:      (r.content_html as string) ?? "",
    signaturePosition: (r.signature_position as SignaturePosition) ?? DEFAULT_SIGNATURE_POSITION,
    versionMinor:     (r.version_minor as number) ?? 0,
    templateType:     ((r.template_type as string) ?? "html") as "html" | "pdf",
    pdfStoragePath:   (r.pdf_storage_path as string | null) ?? null,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

export async function getContractTemplates(orgId: string): Promise<DbContractTemplate[]> {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createContractTemplate(input: {
  orgId:          string;
  name:           string;
  description:    string;
  label?:         string;
  logoHeader?:    boolean;
  logoWatermark?: boolean;
  contentHtml:    string;
  signaturePosition?: SignaturePosition;
}): Promise<DbContractTemplate> {
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      organization_id: input.orgId,
      name:            input.name,
      description:     input.description,
      label:           input.label ?? "",
      logo_header:     input.logoHeader ?? false,
      logo_watermark:  input.logoWatermark ?? false,
      content_html:    input.contentHtml,
      signature_position: input.signaturePosition ?? DEFAULT_SIGNATURE_POSITION,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error creando plantilla");
  return mapRow(data as Record<string, unknown>);
}

export async function updateContractTemplate(
  id: string,
  input: { name?: string; description?: string; label?: string; logoHeader?: boolean; logoWatermark?: boolean; contentHtml?: string; signaturePosition?: SignaturePosition; versionMinor?: number }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name          !== undefined) patch.name             = input.name;
  if (input.description   !== undefined) patch.description      = input.description;
  if (input.label         !== undefined) patch.label            = input.label;
  if (input.logoHeader    !== undefined) patch.logo_header      = input.logoHeader;
  if (input.logoWatermark !== undefined) patch.logo_watermark   = input.logoWatermark;
  if (input.contentHtml   !== undefined) patch.content_html     = input.contentHtml;
  if (input.signaturePosition !== undefined) patch.signature_position = input.signaturePosition;
  if (input.versionMinor  !== undefined) patch.version_minor    = input.versionMinor;
  const { error } = await supabase.from("contract_templates").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("contract_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloneContractTemplate(id: string): Promise<DbContractTemplate> {
  const { data: src, error: srcErr } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (srcErr || !src) throw new Error(srcErr?.message ?? "Plantilla no encontrada");

  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      organization_id: src.organization_id,
      name:            `${src.name} (copia)`,
      description:     src.description,
      label:           src.label ?? "",
      logo_header:     src.logo_header ?? false,
      logo_watermark:  src.logo_watermark ?? false,
      content_html:    src.content_html,
      signature_position: src.signature_position ?? DEFAULT_SIGNATURE_POSITION,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error al clonar plantilla");
  return mapRow(data as Record<string, unknown>);
}

// ─── Variable utilities ───────────────────────────────────────────────────────

/** Auto-filled from selected user at assign time — admin does not fill these */
export const AUTO_FILL_VARS = new Set([
  "nombre_usuario",
  "email_usuario",
  "dni_usuario",
  "cuil_usuario",
  "domicilio_usuario",
]);

/** Variables de la organización — se autocompletan desde configuración de la empresa */
export const ORG_VARS = new Set([
  "nombre_empresa", "nombre_consultora",
  "razon_social", "razon_social_empresa", "razon_social_consultora",
  "cuit_empresa", "cuit_consultora",
  "domicilio_empresa", "domicilio_consultora",
  "ciudad_empresa", "ciudad_consultora",
  "provincia_empresa", "provincia_consultora",
  "email_empresa", "email_consultora",
  "telefono_empresa", "telefono_consultora",
  "representante_legal", "representante_empresa", "representante_consultora",
  "autoridad_nombre", "autoridad_cuil", "autoridad_email",
]);

/** Pre-defined system variables — admin must fill these, but they're known */
export const SYSTEM_VARS = new Set([
  "fecha_inicio", "fecha_fin", "fecha_entrega",
  "monto", "monto_inicial", "monto_final", "cuotas",
  "objeto", "descripcion", "ciudad", "provincia",
]);

/** Extract all {{variable}} names from HTML content */
export function extractVariables(html: string): string[] {
  const matches = [...html.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

/** Upload a PDF file and save it as a reusable PDF template */
export async function createPdfContractTemplate(input: {
  orgId:             string;
  name:              string;
  description?:      string;
  label?:            string;
  file:              File;
  ownerId:           string;
  signaturePosition: SignaturePosition;
}): Promise<DbContractTemplate> {
  const { orgId, name, file, ownerId, signaturePosition } = input;

  // Upload PDF to storage
  const storagePath = `${ownerId}/tpl_${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("contract-pdfs")
    .upload(storagePath, file, { upsert: false, contentType: "application/pdf" });
  if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`);

  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      organization_id:   orgId,
      name,
      description:       input.description ?? "",
      label:             input.label ?? "",
      logo_header:       false,
      logo_watermark:    false,
      content_html:      "",
      signature_position: signaturePosition,
      template_type:     "pdf",
      pdf_storage_path:  storagePath,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error guardando plantilla PDF");
  return mapRow(data as Record<string, unknown>);
}

/** Get the public URL for a PDF template's file */
export function getPdfTemplateUrl(storagePath: string): string {
  const { data } = supabase.storage.from("contract-pdfs").getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Replace {{var}} in HTML with values from a map; unknowns left as-is */
export function interpolateHtml(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

/** Human-readable label for known variable names */
export const VAR_LABELS: Record<string, string> = {
  // Datos del firmante (auto-fill)
  nombre_usuario:    "Nombre del firmante",
  email_usuario:     "Email del firmante",
  dni_usuario:       "DNI del firmante",
  cuil_usuario:      "CUIL/CUIT del firmante",
  domicilio_usuario: "Domicilio del firmante",
  // Datos de la organización (org auto-fill)
  nombre_empresa:    "Nombre de la empresa",
  razon_social:      "Razón social",
  cuit_empresa:      "CUIT de la empresa",
  domicilio_empresa: "Domicilio de la empresa",
  ciudad_empresa:    "Ciudad de la empresa",
  provincia_empresa: "Provincia de la empresa",
  email_empresa:     "Email de contacto",
  telefono_empresa:  "Teléfono de la empresa",
  representante_legal: "Representante legal",
  autoridad_nombre:  "Nombre de la autoridad",
  autoridad_cuil:    "CUIL de la autoridad",
  autoridad_email:   "Email de la autoridad",
  // Variables a completar por el admin
  fecha_inicio:      "Fecha de inicio",
  fecha_fin:         "Fecha de finalización",
  fecha_entrega:     "Fecha de entrega",
  monto:             "Monto",
  monto_inicial:     "Monto inicial",
  monto_final:       "Monto final",
  cuotas:            "Cantidad de cuotas",
  descripcion:       "Descripción",
  objeto:            "Objeto del contrato",
  domicilio:         "Domicilio",
  ciudad:            "Ciudad",
  provincia:         "Provincia",
};
