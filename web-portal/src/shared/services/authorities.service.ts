import { supabase } from "../lib/supabase";

export type AuthorityType   = "PERMANENT" | "PROVISIONAL";
export type AuthorityStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";

export interface OrgAuthority {
  id:               string;
  organizationId:   string;
  userId:           string | null;
  fullName:         string;
  dni:              string | null;
  cuil:             string | null;
  cuit:             string | null;
  domicilio:        string | null;
  email:            string;
  type:             AuthorityType;
  status:           AuthorityStatus;
  signatureUrl:     string | null;
  inviteToken:      string | null;
  notes:            string | null;
  invitedAt:        string;
  acceptedAt:       string | null;
  documentId:       string | null;
  signingRequestId: string | null;
}

export interface AuthorityInviteInfo {
  id:           string;
  fullName:     string;
  email:        string;
  cuil:         string | null;
  type:         AuthorityType;
  status:       AuthorityStatus;
  notes:        string | null;
  inviteToken:  string;
  orgName:      string;
  orgLogoDark:  string | null;
  orgLogoLight: string | null;
}

function mapRow(r: Record<string, unknown>): OrgAuthority {
  return {
    id:               r.id as string,
    organizationId:   r.organization_id as string,
    userId:           (r.user_id as string) ?? null,
    fullName:         r.full_name as string,
    dni:              (r.dni as string) ?? null,
    cuil:             (r.cuil as string) ?? null,
    cuit:             (r.cuit as string) ?? null,
    domicilio:        (r.domicilio as string) ?? null,
    email:            r.email as string,
    type:             r.type as AuthorityType,
    status:           r.status as AuthorityStatus,
    signatureUrl:     (r.signature_url as string) ?? null,
    inviteToken:      (r.invite_token as string) ?? null,
    notes:            (r.notes as string) ?? null,
    invitedAt:        r.invited_at as string,
    acceptedAt:       (r.accepted_at as string) ?? null,
    documentId:       (r.document_id as string) ?? null,
    signingRequestId: (r.signing_request_id as string) ?? null,
  };
}

export async function getOrgAuthorities(organizationId: string): Promise<OrgAuthority[]> {
  const { data, error } = await supabase
    .from("organization_authorities")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const authorities = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));

  // Enriquecer con datos de DIDIT (identity_verifications) para los que ya verificaron
  const userIds = authorities.map((a) => a.userId).filter(Boolean) as string[];
  if (userIds.length > 0) {
    const { data: ivs } = await supabase
      .from("identity_verifications")
      .select("user_id, document_number, cuil_cuit, address, city, province")
      .in("user_id", userIds)
      .eq("status", "APPROVED");

    const ivMap = new Map((ivs ?? []).map((iv) => [iv.user_id as string, iv]));

    return authorities.map((a) => {
      if (!a.userId) return a;
      const iv = ivMap.get(a.userId);
      if (!iv) return a;
      const domicilioRaw = [iv.address, iv.city, iv.province].filter(Boolean).join(", ");
      return {
        ...a,
        dni:       a.dni      ?? (iv.document_number as string) ?? null,
        cuil:      a.cuil     ?? (iv.cuil_cuit as string)       ?? null,
        domicilio: a.domicilio ?? domicilioRaw                   ?? null,
      };
    });
  }

  return authorities;
}

export async function inviteAuthority(input: {
  organizationId:  string;
  fullName:        string;
  email:           string;
  cuil?:           string;
  type:            AuthorityType;
  notes?:          string;
  // Solo para PROVISIONAL: datos del convenio
  convenioTitle?:   string;
  templateId?:      string;
  templateFields?:  Record<string, string>;
}): Promise<OrgAuthority> {
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Crear registro de autoridad
  const { data, error } = await supabase
    .from("organization_authorities")
    .insert({
      organization_id: input.organizationId,
      full_name:       input.fullName,
      email:           input.email,
      cuil:            input.cuil ?? null,
      type:            input.type,
      status:          "PENDING",
      authorized_by:   user?.id ?? null,
      notes:           input.notes ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Error al invitar autoridad");

  const authority = mapRow(data as Record<string, unknown>);

  // 2. Si es PROVISIONAL: crear documento de convenio + signature_request
  if (input.type === "PROVISIONAL" && input.convenioTitle) {
    const title = input.convenioTitle.trim();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Crear el documento de convenio
    const mergedFields: Record<string, string> = {
      ...(input.templateFields ?? {}),
      nombre_firmante:    input.fullName,
      email_firmante:     input.email,
      cuil_firmante:      input.cuil ?? "",
    };

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        title,
        description:     `Convenio de firma provisional — ${input.fullName}`,
        owner_id:        user?.id ?? null,
        organization_id: input.organizationId,
        total_signers:   1,
        status:          "SENT",
        template_id:     input.templateId ?? null,
        template_fields: mergedFields,
      })
      .select()
      .single();
    if (docErr || !doc) throw new Error(docErr?.message ?? "Error al crear convenio");

    // Crear signature_request para la autoridad
    const { data: sr, error: srErr } = await supabase
      .from("signature_requests")
      .insert({
        document_id:   doc.id,
        signer_email:  input.email,
        signer_name:   input.fullName,
        signer_cuil:   input.cuil ?? null,
        status:        "PENDING",
        expires_at:    expiresAt,
        signing_order: 0,
      })
      .select()
      .single();
    if (srErr || !sr) throw new Error(srErr?.message ?? "Error al crear solicitud de firma");

    // Vincular el documento y la solicitud a la autoridad
    await supabase
      .from("organization_authorities")
      .update({
        document_id:        doc.id,
        signing_request_id: sr.id,
      })
      .eq("id", authority.id);

    return {
      ...authority,
      inviteToken:      (data as Record<string, unknown>).invite_token as string,
      documentId:       (doc as Record<string, unknown>).id as string,
      signingRequestId: (sr as Record<string, unknown>).id as string,
    };
  }

  return authority;
}

export async function revokeAuthority(id: string): Promise<void> {
  const { error } = await supabase
    .from("organization_authorities")
    .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadAuthoritySignature(
  authorityId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split(".").pop() ?? "png";
  const path = `${authorityId}/signature.${ext}`;
  const { error } = await supabase.storage
    .from("authority-signatures")
    .upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("authority-signatures").getPublicUrl(path);
  return data.publicUrl;
}

/** Carga los datos de la invitación por token (sin autenticación) */
export async function getAuthorityByToken(token: string): Promise<AuthorityInviteInfo | null> {
  const { data, error } = await supabase.rpc("get_authority_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id:           data.id as string,
    fullName:     data.full_name as string,
    email:        data.email as string,
    cuil:         (data.cuil as string) ?? null,
    type:         data.type as AuthorityType,
    status:       data.status as AuthorityStatus,
    notes:        (data.notes as string) ?? null,
    inviteToken:  data.invite_token as string,
    orgName:      data.org_name as string,
    orgLogoDark:  (data.org_logo_dark as string) ?? null,
    orgLogoLight: (data.org_logo_light as string) ?? null,
  };
}

/** Acepta la invitación y activa la autoridad (sin autenticación) */
export async function acceptAuthorityInvite(
  token: string,
  signatureUrl?: string
): Promise<void> {
  const { data, error } = await supabase.rpc("accept_authority_invite", {
    p_token:         token,
    p_signature_url: signatureUrl ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error("No se pudo aceptar la invitación");
}

/** Construye la URL de invitación para copiar */
export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/authority/accept/${token}`;
}
