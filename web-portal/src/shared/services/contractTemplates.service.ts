import { supabase } from "../lib/supabase";

export interface DbContractTemplate {
  id:             string;
  organizationId: string;
  name:           string;
  description:    string;
  contentHtml:    string;
  createdAt:      string;
  updatedAt:      string;
}

function mapRow(r: Record<string, unknown>): DbContractTemplate {
  return {
    id:             r.id as string,
    organizationId: r.organization_id as string,
    name:           r.name as string,
    description:    (r.description as string) ?? "",
    contentHtml:    r.content_html as string,
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
  orgId:       string;
  name:        string;
  description: string;
  contentHtml: string;
}): Promise<DbContractTemplate> {
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      organization_id: input.orgId,
      name:            input.name,
      description:     input.description,
      content_html:    input.contentHtml,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error creando plantilla");
  return mapRow(data as Record<string, unknown>);
}

export async function updateContractTemplate(
  id: string,
  input: { name?: string; description?: string; contentHtml?: string }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name        !== undefined) patch.name         = input.name;
  if (input.description !== undefined) patch.description  = input.description;
  if (input.contentHtml !== undefined) patch.content_html = input.contentHtml;
  const { error } = await supabase.from("contract_templates").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("contract_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
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
