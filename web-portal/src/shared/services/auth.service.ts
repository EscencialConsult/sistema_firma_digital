/**
 * Authentication service — Supabase implementation.
 * Replaces the previous mock that used sessionStorage.
 */

import { supabase } from "../lib/supabase";
import type { AuthUser, UserProfile, UserRole, VerificationStatus, CertificateStatus } from "../types/user";
export type { AuthUser };

type SupabaseAuthUser = {
  email?: string;
  user_metadata?: {
    full_name?: unknown;
    fullName?: unknown;
  };
};

function fallbackProfile(userId: string, authUser?: SupabaseAuthUser | null): AuthUser | null {
  if (!authUser?.email) return null;

  const fullName =
    typeof authUser.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name
      : typeof authUser.user_metadata?.fullName === "string"
        ? authUser.user_metadata.fullName
        : authUser.email.split("@")[0];

  return {
    id: userId,
    email: authUser.email,
    fullName,
    role: "USER",
    verificationStatus: "PENDING",
    certificateStatus: "NONE",
  };
}

// ─── Profile helper ───────────────────────────────────────────────────────────

/** Fetch the public.users profile row and map to AuthUser */
export async function fetchProfile(userId: string, authUser?: SupabaseAuthUser | null): Promise<AuthUser | null> {
  const [profile, kycStatus, memberships] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, role, verification_status, certificate_status, organization_id, terms_accepted_at, document_number, cuil_cuit, birth_date, phone, address")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("get_my_kyc_status"),
    supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const { data, error } = profile;
  if (error || !data) return fallbackProfile(userId, authUser);

  // El status real puede estar en identity_verifications — priorizarlo
  const kycRow = kycStatus?.data as Record<string, unknown> | null;
  const realStatus = kycRow?.status
    ? (kycRow.status as string)
    : data.verification_status;

  const memberOrgIds = (memberships.data ?? []).map(
    (r: Record<string, unknown>) => r.organization_id as string
  );
  // Incluir la org primaria si no está en la tabla de membresías
  const primaryOrgId = data.organization_id as string | undefined;
  if (primaryOrgId && !memberOrgIds.includes(primaryOrgId)) {
    memberOrgIds.unshift(primaryOrgId);
  }

  return {
    id:                 data.id,
    email:              data.email,
    fullName:           data.full_name,
    role:               data.role               as UserRole,
    verificationStatus: realStatus as VerificationStatus,
    certificateStatus:  data.certificate_status  as CertificateStatus,
    organizationId:     primaryOrgId,
    termsAcceptedAt:    data.terms_accepted_at ?? undefined,
    memberOrgIds,
    isMultiOrg:         memberOrgIds.length > 1,
  };
}

async function fetchRequiredProfile(userId: string): Promise<AuthUser> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, verification_status, certificate_status, organization_id, terms_accepted_at, document_number, cuil_cuit, birth_date, phone, address")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("La cuenta se creo en Auth, pero falta el perfil en public.users. Revisa el trigger fn_handle_new_user en Supabase.");
  }

  return {
    id:                 data.id,
    email:              data.email,
    fullName:           data.full_name,
    role:               data.role               as UserRole,
    verificationStatus: data.verification_status as VerificationStatus,
    certificateStatus:  data.certificate_status  as CertificateStatus,
    organizationId:     data.organization_id ?? undefined,
    termsAcceptedAt:    data.terms_accepted_at ?? undefined,
  };
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
      throw new Error("Tu cuenta aún no fue confirmada. Revisá tu casilla de correo y hacé clic en el link de verificación.");
    }
    if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
      throw new Error("Email o contraseña incorrectos.");
    }
    const status = (error as any)?.status;
    if (status === 500) throw new Error("Error del servidor, intentá más tarde.");
    throw new Error(error.message);
  }
  if (!data.user) throw new Error("No se pudo iniciar sesión.");

  // Fetch profile (created by trigger on signup)
  const profile = await fetchProfile(data.user.id, data.user);
  if (!profile) throw new Error("No se encontró el perfil del usuario.");
  return profile;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  organizationId?: string;
}): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({
    email:    input.email,
    password: input.password,
    options:  { data: { full_name: input.fullName, organization_id: input.organizationId ?? null } },
  });

  if (error) {
    const status = (error as any)?.status;
    if (status === 429 || error.message.toLowerCase().includes("rate limit")) {
      throw new Error("Supabase limito temporalmente los registros con email. Espera unos minutos o usa otro correo de prueba.");
    }
    throw new Error(error.message);
  }
  if (!data.user) throw new Error("No se pudo crear la cuenta.");
  if (!data.session?.access_token) {
    throw new Error("Cuenta creada. Antes de iniciar la verificacion, confirma tu email e inicia sesion.");
  }

  // Trigger fn_handle_new_user creates the profile, but may take a brief moment.
  // Retry up to 3 times with 600ms delay.
  for (let i = 0; i < 3; i++) {
    try {
      return await fetchRequiredProfile(data.user.id);
    } catch {
      // Profile trigger can lag briefly after Auth signup.
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  return fetchRequiredProfile(data.user.id);
}

export async function restoreSession(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return fetchProfile(session.user.id, session.user);
}

export async function fetchMe(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return fetchProfile(user.id, user);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw new Error("No se pudo reenviar el email. Intentá de nuevo.");
}

/**
 * Update local profile data in Supabase.
 * Used after KYC status changes (admin approval).
 * Returns updated AuthUser or null if failed.
 */
export async function updateSessionUser(updates: Partial<AuthUser & UserProfile>): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.fullName)           dbUpdates.full_name           = updates.fullName;
  if (updates.verificationStatus) dbUpdates.verification_status = updates.verificationStatus;
  if (updates.certificateStatus)  dbUpdates.certificate_status  = updates.certificateStatus;
  if (updates.role)               dbUpdates.role                = updates.role;
  if (updates.documentNumber)     dbUpdates.document_number     = updates.documentNumber;
  if (updates.cuilCuit)           dbUpdates.cuil_cuit           = updates.cuilCuit;
  if (updates.birthDate)          dbUpdates.birth_date          = updates.birthDate;
  if (updates.phone)              dbUpdates.phone               = updates.phone;
  if (updates.address)            dbUpdates.address             = updates.address;
  if (updates.termsAcceptedAt)    dbUpdates.terms_accepted_at   = updates.termsAcceptedAt;

  if (Object.keys(dbUpdates).length > 0) {
    await supabase.from("users").update(dbUpdates).eq("id", user.id);
  }

  return fetchProfile(user.id, user);
}
