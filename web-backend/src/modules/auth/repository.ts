import { query } from "../../database/pool.js";
import { sha256 } from "../../utils/crypto.js";
import type { UserRecord } from "./types.js";

export async function findUserByEmail(email: string) {
  const result = await query<UserRecord>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string) {
  const result = await query<UserRecord>("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function findPublicUserByEmail(email: string) {
  const result = await query<Pick<UserRecord, "id" | "email" | "role" | "verification_status" | "full_name">>(
    "SELECT id, email, role, verification_status, full_name FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: { email: string; passwordHash: string; fullName: string; organizationName?: string }) {
  const client = await (await import("../../database/pool.js")).pool.connect();
  try {
    await client.query("BEGIN");
    let organizationId: string | null = null;
    if (input.organizationName) {
      const org = await client.query("INSERT INTO organizations (name) VALUES ($1) RETURNING id", [input.organizationName]);
      organizationId = org.rows[0].id;
    }
    const user = await client.query<UserRecord>(
      `INSERT INTO users (organization_id, email, password_hash, full_name)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [organizationId, input.email.toLowerCase(), input.passwordHash, input.fullName]
    );
    await client.query("COMMIT");
    return user.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createRefreshToken(userId: string, token: string, expiresAt: Date) {
  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1,$2,$3)
     RETURNING id`,
    [userId, sha256(token), expiresAt]
  );
  return result.rows[0] as { id: string };
}

export async function findRefreshToken(tokenId: string, token: string) {
  const result = await query(
    `SELECT * FROM refresh_tokens
     WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenId, sha256(token)]
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(tokenId: string) {
  await query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [tokenId]);
}
