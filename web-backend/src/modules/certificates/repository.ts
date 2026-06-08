import { query } from "../../database/pool.js";

export async function getCertificateOwner(userId: string) {
  const result = await query(
    "SELECT id, email, full_name, verification_status FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function createCertificate(userId: string, input: Record<string, any>) {
  const result = await query(
    `INSERT INTO certificates
      (user_id, label, type, issuer, subject, serial_number, valid_from, valid_to, fingerprint_sha256, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [userId, input.label, input.type, input.issuer ?? null, input.subject ?? null, input.serialNumber ?? null, input.validFrom ?? null, input.validTo ?? null, input.fingerprintSha256 ?? null, input.metadata ?? {}]
  );
  await query("UPDATE users SET certificate_status = 'ACTIVE', updated_at = now() WHERE id = $1", [userId]);
  return result.rows[0];
}

export async function listCertificates(userId: string) {
  const result = await query("SELECT * FROM certificates WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  return result.rows;
}

export async function getCertificate(userId: string, id: string) {
  const result = await query("SELECT * FROM certificates WHERE user_id = $1 AND id = $2", [userId, id]);
  return result.rows[0] ?? null;
}

export async function updateCertificateStatus(userId: string, id: string, status: string) {
  const result = await query(
    "UPDATE certificates SET status = $3 WHERE user_id = $1 AND id = $2 RETURNING *",
    [userId, id, status]
  );
  if (result.rows[0]) {
    const active = await query("SELECT 1 FROM certificates WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1", [userId]);
    await query("UPDATE users SET certificate_status = $2, updated_at = now() WHERE id = $1", [
      userId,
      (active.rowCount ?? 0) > 0 ? "ACTIVE" : "NONE"
    ]);
  }
  return result.rows[0] ?? null;
}
