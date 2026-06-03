import { query } from "../../database/pool.js";

export async function getUserProfile(userId: string) {
  const result = await query(
    `SELECT id, email, full_name, role, organization_id, verification_status, certificate_status, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function updateUserProfile(userId: string, input: { fullName?: string }) {
  const result = await query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name), updated_at = now()
     WHERE id = $1
     RETURNING id, email, full_name, role, organization_id, verification_status, certificate_status, created_at`,
    [userId, input.fullName ?? null]
  );
  return result.rows[0];
}

