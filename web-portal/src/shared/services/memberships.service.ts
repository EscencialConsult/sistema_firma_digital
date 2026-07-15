import { supabase } from "../lib/supabase";
import { getOrgByInviteCode } from "./organizations.service";
import type { Organization } from "../types/organization";

export interface OrgMembership {
  id: string;
  userId: string;
  organizationId: string;
  status: "active" | "pending" | "rejected";
  role: "USER" | "ADMIN" | "ORG_ADMIN";
  invitedBy?: string;
  createdAt: string;
  user?: { email: string; fullName: string };
  organization?: { name: string; slug: string; brandPrimary?: string; logoLightUrl?: string; logoDarkUrl?: string };
}

export interface OrgInvitation {
  id: string;
  email: string;
  organizationId: string;
  invitedBy: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  organization?: { name: string; slug: string; brandPrimary?: string; logoLightUrl?: string; logoDarkUrl?: string };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Membresías activas del usuario actual */
export async function getMyMemberships(): Promise<OrgMembership[]> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select(`*, organization:organizations(name, slug, brand_primary, logo_light_url, logo_dark_url)`)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMembership);
}

/** IDs de orgs donde el usuario autenticado tiene membresía activa */
export async function getMyOrgIds(): Promise<string[]> {
  const memberships = await getMyMemberships();
  return memberships.map((m) => m.organizationId);
}

/** Membresía del usuario actual en una org específica (undefined si no existe) */
export async function getMembershipForOrg(orgId: string): Promise<OrgMembership | undefined> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMembership(data) : undefined;
}

/** Lista de membresías de una org — para el panel de admin */
export async function getOrgMemberships(orgId: string): Promise<OrgMembership[]> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select(`*, user:users(email, full_name)`)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMembership);
}

// ─── Invitaciones ─────────────────────────────────────────────────────────────

/** Crea una invitación para un usuario existente. Devuelve el token generado. */
export async function inviteUserToOrg(
  email: string,
  orgId: string
): Promise<{ token: string; invitationId: string }> {
  // Si ya existe una invitación pending para este email+org, cancelarla primero
  await supabase
    .from("org_user_invitations")
    .update({ status: "cancelled" })
    .eq("email", email.toLowerCase())
    .eq("organization_id", orgId)
    .eq("status", "pending");

  const { data: me } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("org_user_invitations")
    .insert({
      email: email.toLowerCase(),
      organization_id: orgId,
      invited_by: me?.user?.id,
    })
    .select("id, token")
    .single();
  if (error) throw error;
  return { token: data.token, invitationId: data.id };
}

/** Lee una invitación por token (pública — para la página /invite/:token) */
export async function getInvitationByToken(token: string): Promise<OrgInvitation | null> {
  const { data, error } = await supabase
    .from("org_user_invitations")
    .select(`
      *,
      organization:organizations(name, slug, brand_primary, logo_light_url, logo_dark_url)
    `)
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapInvitation(data);
}

/** Acepta una invitación — crea la membresía y marca el token como usado */
export async function acceptOrgInvitation(token: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user?.id) throw new Error("Debés iniciar sesión para aceptar la invitación.");

  const inv = await getInvitationByToken(token);
  if (!inv) throw new Error("Invitación no encontrada.");
  if (inv.status !== "pending") throw new Error("Esta invitación ya fue usada o expiró.");
  if (new Date(inv.expiresAt) < new Date()) throw new Error("La invitación expiró.");
  if (inv.email !== me.user.email?.toLowerCase())
    throw new Error("Esta invitación es para otro correo electrónico.");

  // Crear membresía
  const { error: membError } = await supabase
    .from("organization_memberships")
    .upsert(
      { user_id: me.user.id, organization_id: inv.organizationId, status: "active", role: "USER" },
      { onConflict: "user_id,organization_id" }
    );
  if (membError) throw membError;

  // Marcar invitación como aceptada
  await supabase
    .from("org_user_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("token", token);
}

/**
 * El usuario ingresa el código de su panel → se une a esa org inmediatamente.
 * Devuelve la org para mostrarla en el feedback visual.
 */
export async function joinOrgByCode(code: string): Promise<Organization> {
  const org = await getOrgByInviteCode(code);
  if (!org) throw new Error("Código inválido. Verificá que esté bien escrito.");
  if (!org.isActive) throw new Error("Esta organización no está activa.");

  const { data: me } = await supabase.auth.getUser();
  if (!me?.user?.id) throw new Error("Debés iniciar sesión.");

  const { error } = await supabase
    .from("organization_memberships")
    .upsert(
      { user_id: me.user.id, organization_id: org.id, status: "active", role: "USER" },
      { onConflict: "user_id,organization_id" }
    );
  if (error) throw new Error(error.message);
  return org;
}

/** Solicita acceso a una org desde la página /:slug (usuario pide por cuenta propia) */
export async function requestOrgAccess(orgId: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user?.id) throw new Error("Debés iniciar sesión.");

  const { error } = await supabase
    .from("organization_memberships")
    .upsert(
      { user_id: me.user.id, organization_id: orgId, status: "pending", role: "USER" },
      { onConflict: "user_id,organization_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Aprueba o rechaza una solicitud pendiente — solo admins */
export async function updateMembershipStatus(
  membershipId: string,
  status: "active" | "rejected"
): Promise<void> {
  const { error } = await supabase
    .from("organization_memberships")
    .update({ status })
    .eq("id", membershipId);
  if (error) throw error;
}

/** Lista invitaciones pendientes de una org — para panel de admin */
export async function getPendingInvitations(orgId: string): Promise<OrgInvitation[]> {
  const { data, error } = await supabase
    .from("org_user_invitations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInvitation);
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapMembership(r: Record<string, unknown>): OrgMembership {
  const u = r.user as Record<string, unknown> | undefined;
  const org = r.organization as Record<string, unknown> | undefined;
  return {
    id:             r.id as string,
    userId:         r.user_id as string,
    organizationId: r.organization_id as string,
    status:         r.status as OrgMembership["status"],
    role:           r.role as OrgMembership["role"],
    invitedBy:      r.invited_by as string | undefined,
    createdAt:      r.created_at as string,
    user: u ? { email: u.email as string, fullName: u.full_name as string } : undefined,
    organization: org
      ? {
          name:         org.name as string,
          slug:         org.slug as string,
          brandPrimary: org.brand_primary as string | undefined,
          logoLightUrl: org.logo_light_url as string | undefined,
          logoDarkUrl:  org.logo_dark_url as string | undefined,
        }
      : undefined,
  };
}

function mapInvitation(r: Record<string, unknown>): OrgInvitation {
  const org = r.organization as Record<string, unknown> | undefined;
  return {
    id:             r.id as string,
    email:          r.email as string,
    organizationId: r.organization_id as string,
    invitedBy:      r.invited_by as string,
    token:          r.token as string,
    status:         r.status as OrgInvitation["status"],
    expiresAt:      r.expires_at as string,
    acceptedAt:     r.accepted_at as string | undefined,
    createdAt:      r.created_at as string,
    organization: org
      ? {
          name:         org.name as string,
          slug:         org.slug as string,
          brandPrimary: org.brand_primary as string | undefined,
          logoLightUrl: org.logo_light_url as string | undefined,
          logoDarkUrl:  org.logo_dark_url as string | undefined,
        }
      : undefined,
  };
}
