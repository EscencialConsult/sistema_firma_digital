/**
 * Admin service — Mock implementation.
 * TODO:SUPABASE — Replace with supabase.from('users'), supabase.rpc('get_admin_stats'), etc.
 */

import type { AdminUserSummary } from "../types/user";
import { MOCK_USERS, MOCK_ADMIN_STATS } from "../mock/data";

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingKyc: number;
  totalContracts: number;
  signedContracts: number;
  pendingContracts: number;
  rejectedContracts: number;
}

// TODO:SUPABASE — Replace with supabase.rpc('get_admin_stats') or multiple count queries
export async function getAdminStats(): Promise<AdminStats> {
  await delay();
  return MOCK_ADMIN_STATS;
}

// TODO:SUPABASE — Replace with supabase.from('users').select('*').order('created_at', { ascending: false })
export async function getAllUsers(): Promise<AdminUserSummary[]> {
  await delay();
  return Object.values(MOCK_USERS).map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    verificationStatus: u.verificationStatus,
    certificateStatus: u.certificateStatus,
    createdAt: "2026-05-15T10:00:00Z",
  }));
}

// TODO:SUPABASE — Replace with supabase.from('users').select('*').eq('id', id).single()
export async function getUserById(id: string): Promise<AdminUserSummary | null> {
  await delay();
  const user = Object.values(MOCK_USERS).find((u) => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    verificationStatus: user.verificationStatus,
    certificateStatus: user.certificateStatus,
    createdAt: "2026-05-15T10:00:00Z",
  };
}
