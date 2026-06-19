import { supabase } from "../lib/supabase";

export interface ConvenioTemplate {
  id:                    string;
  organizationId:        string;
  name:                  string;
  description:           string;
  contentHtml:           string;
  status:                "UNCONFIRMED" | "CONFIRMED";
  approvalDocumentId:    string | null;
  provisionalSignerName: string | null;
  provisionalSignerEmail:string | null;
  confirmedAt:           string | null;
  createdAt:             string;
  updatedAt:             string;
}

function mapRow(r: Record<string, unknown>): ConvenioTemplate {
  return {
    id:                     r.id as string,
    organizationId:         r.organization_id as string,
    name:                   r.name as string,
    description:            (r.description as string) ?? "",
    contentHtml:            r.content_html as string,
    status:                 (r.status as "UNCONFIRMED" | "CONFIRMED"),
    approvalDocumentId:     (r.approval_document_id as string | null) ?? null,
    provisionalSignerName:  (r.provisional_signer_name as string | null) ?? null,
    provisionalSignerEmail: (r.provisional_signer_email as string | null) ?? null,
    confirmedAt:            (r.confirmed_at as string | null) ?? null,
    createdAt:              r.created_at as string,
    updatedAt:              r.updated_at as string,
  };
}

export async function getConvenioTemplates(orgId: string): Promise<ConvenioTemplate[]> {
  const { data, error } = await supabase
    .from("convenio_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const templates = (data ?? []).map(mapRow);

  // Auto-confirmar cuando el documento de aprobación fue firmado
  const toCheck = templates.filter((t) => t.status === "UNCONFIRMED" && t.approvalDocumentId);
  if (toCheck.length > 0) {
    const docIds = toCheck.map((t) => t.approvalDocumentId!);
    const { data: docs } = await supabase
      .from("documents")
      .select("id, status")
      .in("id", docIds);

    const signedIds = new Set(
      (docs ?? [])
        .filter((d: Record<string, unknown>) => d.status === "SIGNED" || d.status === "COMPLETED")
        .map((d: Record<string, unknown>) => d.id as string)
    );

    for (const tpl of toCheck) {
      if (signedIds.has(tpl.approvalDocumentId!)) {
        await supabase
          .from("convenio_templates")
          .update({ status: "CONFIRMED", confirmed_at: new Date().toISOString() })
          .eq("id", tpl.id);
        tpl.status      = "CONFIRMED";
        tpl.confirmedAt = new Date().toISOString();
      }
    }
  }

  return templates;
}

export async function createConvenioTemplate(input: {
  orgId:       string;
  name:        string;
  description: string;
  contentHtml: string;
}): Promise<ConvenioTemplate> {
  const { data, error } = await supabase
    .from("convenio_templates")
    .insert({
      organization_id: input.orgId,
      name:            input.name,
      description:     input.description,
      content_html:    input.contentHtml,
      status:          "UNCONFIRMED",
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error creando plantilla");
  return mapRow(data as Record<string, unknown>);
}

export async function updateConvenioTemplate(
  id: string,
  input: { name?: string; description?: string; contentHtml?: string }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name        !== undefined) patch.name         = input.name;
  if (input.description !== undefined) patch.description  = input.description;
  if (input.contentHtml !== undefined) patch.content_html = input.contentHtml;
  const { error } = await supabase.from("convenio_templates").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteConvenioTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("convenio_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Activa una plantilla de convenio enviando el documento al usuario elegido como
 * autoridad provisional. Cuando ese usuario firme, la plantilla queda CONFIRMED.
 */
export async function activateConvenioTemplate(
  templateId: string,
  authority: { name: string; email: string; cuil?: string | null }
): Promise<void> {
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) throw new Error("No autenticado");

  const { data: tpl, error: tplErr } = await supabase
    .from("convenio_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (tplErr || !tpl) throw new Error("Plantilla no encontrada");

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Crear documento de aprobación para que la autoridad provisional firme
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      title:           `[Aprobación] ${tpl.name as string}`,
      description:     "Revisión y firma de convenio como autoridad provisional",
      owner_id:        authUser.user.id,
      template_id:     "custom",
      template_fields: {
        _templateContent:      tpl.content_html,
        _legalTitle:           tpl.name,
        _dbTemplateId:         templateId,
        _isConvenioApproval:   "true",
        nombre_usuario:        authority.name,
        email_usuario:         authority.email,
        cuil_usuario:          authority.cuil ?? "",
      },
      status:          "SENT",
      total_signers:   1,
      completed_signers: 0,
    })
    .select("id")
    .single();
  if (docErr || !doc) throw new Error(docErr?.message ?? "Error creando documento");

  // Solicitud de firma para la autoridad provisional
  const { error: srErr } = await supabase.from("signature_requests").insert({
    document_id:   (doc as Record<string, unknown>).id,
    signer_email:  authority.email,
    signer_name:   authority.name,
    signer_cuil:   authority.cuil ?? null,
    status:        "PENDING",
    expires_at:    expiresAt,
    signing_order: 0,
  });
  if (srErr) throw new Error(srErr.message);

  // Vincular documento de aprobación a la plantilla
  const { error: updErr } = await supabase
    .from("convenio_templates")
    .update({
      approval_document_id:   (doc as Record<string, unknown>).id,
      provisional_signer_name:  authority.name,
      provisional_signer_email: authority.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);
  if (updErr) throw new Error(updErr.message);
}
