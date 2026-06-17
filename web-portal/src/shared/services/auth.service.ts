/**
 * Authentication service — Mock implementation.
 * TODO:SUPABASE — Replace with supabase.auth.signInWithPassword(), supabase.auth.signUp(), etc.
 */

import type { AuthUser } from "../types/user";
import { MOCK_USERS } from "../mock/data";

const STORAGE_KEY = "firma_mock_session";

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

function findMockUser(email: string, password: string) {
  return Object.values(MOCK_USERS).find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
}

function toAuthUser(u: (typeof MOCK_USERS)[keyof typeof MOCK_USERS]): AuthUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    verificationStatus: u.verificationStatus,
    certificateStatus: u.certificateStatus,
  };
}

// TODO:SUPABASE — Replace with supabase.auth.signInWithPassword({ email, password })
export async function login(email: string, password: string): Promise<AuthUser> {
  await delay();
  const user = findMockUser(email, password);
  if (!user) throw new Error("Email o contraseña incorrectos.");
  const authUser = toAuthUser(user);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  return authUser;
}

// TODO:SUPABASE — Replace with supabase.auth.signUp({ email, password, options: { data: { full_name } } })
export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  await delay();
  const existing = Object.values(MOCK_USERS).find(
    (u) => u.email.toLowerCase() === input.email.toLowerCase()
  );
  if (existing) throw new Error("El email ya está registrado.");
  const newUser: AuthUser = {
    id: `u-new-${Date.now()}`,
    email: input.email,
    fullName: input.fullName,
    role: "USER",
    verificationStatus: "PENDING",
    certificateStatus: "NONE",
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
}

// TODO:SUPABASE — Replace with supabase.auth.getSession()
export async function restoreSession(): Promise<AuthUser | null> {
  await delay(200);
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  return JSON.parse(stored) as AuthUser;
}

// TODO:SUPABASE — Replace with supabase.auth.getUser()
export async function fetchMe(): Promise<AuthUser | null> {
  return restoreSession();
}

// TODO:SUPABASE — Replace with supabase.auth.signOut()
export async function logout(): Promise<void> {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Update the cached user in session (used after KYC status changes).
 * TODO:SUPABASE — This won't be needed; Supabase session auto-refreshes.
 */
export function updateSessionUser(updates: Partial<AuthUser>): AuthUser | null {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  const user = { ...JSON.parse(stored), ...updates } as AuthUser;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}
