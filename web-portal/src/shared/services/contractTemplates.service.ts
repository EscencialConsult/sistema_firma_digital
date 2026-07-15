import { supabase } from "../lib/supabase";
import { DEFAULT_SIGNATURE_POSITION, type SignaturePosition } from "../types/contract";

export interface DbContractTemplate {
  id:             string;
  organizationId: string;
  name:           string;
  description:    string;
  label:          string;
  logoHeader:     boolean;
  logoWatermark:  boolean;
  contentHtml:    string;
  signaturePosition: SignaturePosition;
  createdAt:      string;
  updatedAt:      string;
}

function mapRow(r: Record<string, unknown>): DbContractTemplate {
  return {
    id:             r.id as string,
    organizationId: r.organization_id as string,
    name:           r.name as string,
    description:    (r.description as string) ?? "",
    label:          (r.label as string) ?? "",
    logoHeader:     (r.logo_header as boolean) ?? false,
    logoWatermark:  (r.logo_watermark as boolean) ?? false,
    contentHtml:    r.content_html as string,
    signaturePosition: (r.signature_position as SignaturePosition) ?? DEFAULT_SIGNATURE_POSITION,
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
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
  input: { name?: string; description?: string; label?: string; logoHeader?: boolean; logoWatermark?: boolean; contentHtml?: string; signaturePosition?: SignaturePosition }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name         !== undefined) patch.name          = input.name;
  if (input.description  !== undefined) patch.description   = input.description;
  if (input.label        !== undefined) patch.label         = input.label;
  if (input.logoHeader   !== undefined) patch.logo_header   = input.logoHeader;
  if (input.logoWatermark !== undefined) patch.logo_watermark = input.logoWatermark;
  if (input.contentHtml  !== undefined) patch.content_html  = input.contentHtml;
  if (input.signaturePosition !== undefined) patch.signature_position = input.signaturePosition;
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

/** Extract all {{variable}} names from HTML content */
export function extractVariables(html: string): string[] {
  const matches = [...html.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

/** Replace {{var}} in HTML with values from a map; unknowns left as-is */
export function interpolateHtml(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

/** Human-readable label for known variable names */
export const VAR_LABELS: Record<string, string> = {
  nombre_usuario:    "Nombre del usuario",
  email_usuario:     "Email del usuario",
  dni_usuario:       "DNI del usuario",
  cuil_usuario:      "CUIL/CUIT del usuario",
  domicilio_usuario: "Domicilio del usuario",
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
