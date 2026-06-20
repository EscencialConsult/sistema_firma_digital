import { supabase } from "../lib/supabase";
import type { AdminUserSummary, UserRole, VerificationStatus, CertificateStatus } from "../types/user";

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingKyc: number;
  totalContracts: number;
  signedContracts: number;
  pendingContracts: number;
  rejectedContracts: number;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** Uses the get_admin_stats() RPC function defined in the schema */
export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc("get_admin_stats");

  if (error) {
    return getAdminStatsFallback();
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalUsers:        Number(row?.totalUsers        ?? row?.total_users        ?? 0),
    verifiedUsers:     Number(row?.verifiedUsers     ?? row?.verified_users     ?? 0),
    pendingKyc:        Number(row?.pendingKyc        ?? row?.pending_kyc        ?? 0),
    totalContracts:    Number(row?.totalContracts    ?? row?.total_contracts    ?? 0),
    signedContracts:   Number(row?.signedContracts   ?? row?.signed_contracts   ?? 0),
    pendingContracts:  Number(row?.pendingContracts  ?? row?.pending_contracts  ?? 0),
    rejectedContracts: Number(row?.rejectedContracts ?? row?.rejected_contracts ?? 0),
  };
}

async function countRows(table: string, build?: (query: any) => any): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (build) query = build(query);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function getAdminStatsFallback(): Promise<AdminStats> {
  const [
    totalUsers,
    verifiedUsers,
    pendingKyc,
    totalContracts,
    signedDocuments,
    signedRequests,
    pendingContracts,
    rejectedContracts,
  ] = await Promise.all([
    countRows("users", (q) => q.eq("role", "USER")),
    countRows("users", (q) => q.eq("verification_status", "VERIFIED")),
    countRows("identity_verifications", (q) => q.in("status", ["PENDING", "IN_REVIEW"])),
    countRows("documents"),
    countRows("documents", (q) => q.eq("status", "COMPLETED")),
    countRows("signature_requests", (q) => q.eq("status", "SIGNED")),
    countRows("documents", (q) => q.in("status", ["SENT", "VIEWED", "CONFORMITY_ACCEPTED"])),
    countRows("documents", (q) => q.in("status", ["REJECTED", "EXPIRED"])),
  ]);

  return {
    totalUsers,
    verifiedUsers,
    pendingKyc,
    totalContracts,
    signedContracts: Math.max(signedDocuments, signedRequests),
    pendingContracts,
    rejectedContracts,
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

function mapRowToUser(row: Record<string, unknown>): AdminUserSummary {
  return {
    id:                 row.id as string,
    email:              row.email as string,
    fullName:           row.full_name as string,
    role:               row.role as UserRole,
    verificationStatus: row.verification_status as VerificationStatus,
    certificateStatus:  row.certificate_status as CertificateStatus,
    createdAt:          row.created_at as string,
    documentNumber:     (row.document_number as string) ?? null,
    cuilCuit:           (row.cuil_cuit as string)       ?? null,
    address:            (row.address as string)         ?? null,
  };
}

const USER_SELECT = "id, email, full_name, role, verification_status, certificate_status, created_at, document_number, cuil_cuit, address";

export async function getAllUsers(): Promise<AdminUserSummary[]> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRowToUser(row as Record<string, unknown>));
}

export async function getUserById(id: string): Promise<AdminUserSummary | null> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRowToUser(data as Record<string, unknown>);
}

/** Promote or demote a user role (admin only, enforced by RLS) */
export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from("users").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Create a new user from the admin panel.
 * Calls the admin-create-user Edge Function which uses the service_role key server-side.
 * Requires deploy: supabase functions deploy admin-create-user
 */
export async function createAdminUser(input: {
  fullName:        string;
  email:           string;
  password:        string;
  role:            UserRole;
  organization_id?: string;
}): Promise<AdminUserSummary> {
  const { data, error } = await supabase.functions.invoke("admin-create-user", { body: input });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Error al crear el usuario");
  return mapRowToUser(data.user as Record<string, unknown>);
}
