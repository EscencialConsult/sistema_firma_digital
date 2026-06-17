/**
 * Authentication service — Supabase implementation.
 * Replaces the previous mock that used sessionStorage.
 */

import { supabase } from "../lib/supabase";
import type { AuthUser, UserRole, VerificationStatus, CertificateStatus } from "../types/user";

// ─── Profile helper ───────────────────────────────────────────────────────────

/** Fetch the public.users profile row and map to AuthUser */
export async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, verification_status, certificate_status, organization_id")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id:                 data.id,
    email:              data.email,
    fullName:           data.full_name,
    role:               data.role               as UserRole,
    verificationStatus: data.verification_status as VerificationStatus,
    certificateStatus:  data.certificate_status  as CertificateStatus,
    organizationId:     data.organization_id ?? undefined,
  };
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("No se pudo iniciar sesión.");

  // Fetch profile (created by trigger on signup)
  const profile = await fetchProfile(data.user.id);
  if (!profile) throw new Error("No se encontró el perfil del usuario.");
  return profile;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({
    email:    input.email,
    password: input.password,
    options:  { data: { full_name: input.fullName } },
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("No se pudo crear la cuenta.");

  // Trigger fn_handle_new_user creates the profile, but may take a brief moment.
  // Retry up to 3 times with 600ms delay.
  for (let i = 0; i < 3; i++) {
    const profile = await fetchProfile(data.user.id);
    if (profile) return profile;
    await new Promise((r) => setTimeout(r, 600));
  }

  // Fallback: return minimal profile from auth data
  return {
    id:                 data.user.id,
    email:              input.email,
    fullName:           input.fullName,
    role:               "USER",
    verificationStatus: "PENDING",
    certificateStatus:  "NONE",
  };
}

export async function restoreSession(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return fetchProfile(session.user.id);
}

export async function fetchMe(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return fetchProfile(user.id);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Update local profile data in Supabase.
 * Used after KYC status changes (admin approval).
 * Returns updated AuthUser or null if failed.
 */
export async function updateSessionUser(updates: Partial<AuthUser>): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.fullName)           dbUpdates.full_name           = updates.fullName;
  if (updates.verificationStatus) dbUpdates.verification_status = updates.verificationStatus;
  if (updates.certificateStatus)  dbUpdates.certificate_status  = updates.certificateStatus;
  if (updates.role)               dbUpdates.role                = updates.role;

  if (Object.keys(dbUpdates).length > 0) {
    await supabase.from("users").update(dbUpdates).eq("id", user.id);
  }

  return fetchProfile(user.id);
}
