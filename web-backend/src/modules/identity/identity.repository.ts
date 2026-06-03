import { pool, query } from "../../database/pool.js";
import type { IdentityAuditAction, IdentityDocumentType, IdentityStatus } from "./identity.types.js";

type Context = { ipAddress?: string; userAgent?: string };

export async function createIdentityAuditLog(input: {
  userId?: string | null;
  verificationId?: string | null;
  action: IdentityAuditAction;
  context?: Context;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO identity_audit_logs
      (user_id, identity_verification_id, action, ip, user_agent, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.userId ?? null,
      input.verificationId ?? null,
      input.action,
      input.context?.ipAddress ?? null,
      input.context?.userAgent ?? null,
      input.metadata ?? {}
    ]
  );
}

export async function getLatestVerification(userId: string) {
  const result = await query(
    `SELECT iv.*, u.email AS user_email, u.full_name AS user_full_name,
      COALESCE(json_agg(idoc.*) FILTER (WHERE idoc.id IS NOT NULL), '[]') AS documents
     FROM identity_verifications iv
     JOIN users u ON u.id = iv.user_id
     LEFT JOIN identity_documents idoc ON idoc.identity_verification_id = iv.id
     WHERE iv.user_id = $1
     GROUP BY iv.id, u.email, u.full_name
     ORDER BY iv.created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function getVerificationById(id: string) {
  const result = await query(
    `SELECT iv.*, u.email AS user_email, u.full_name AS user_full_name,
      COALESCE(json_agg(idoc.*) FILTER (WHERE idoc.id IS NOT NULL), '[]') AS documents
     FROM identity_verifications iv
     JOIN users u ON u.id = iv.user_id
     LEFT JOIN identity_documents idoc ON idoc.identity_verification_id = iv.id
     WHERE iv.id = $1
     GROUP BY iv.id, u.email, u.full_name`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function getIdentityAuditLogs(verificationId: string) {
  const result = await query(
    "SELECT * FROM identity_audit_logs WHERE identity_verification_id = $1 ORDER BY created_at ASC",
    [verificationId]
  );
  return result.rows;
}

export async function createVerification(userId: string, context: Context) {
  const result = await query(
    `INSERT INTO identity_verifications (user_id, status, ip_address, user_agent)
     VALUES ($1,'PENDING',$2,$3)
     RETURNING *`,
    [userId, context.ipAddress ?? null, context.userAgent ?? null]
  );
  return result.rows[0];
}

export async function updatePersonalData(userId: string, verificationId: string, input: Record<string, unknown>) {
  const result = await query(
    `UPDATE identity_verifications SET
      full_name = $3,
      document_type = $4,
      document_number = $5,
      birth_date = $6,
      nationality = $7,
      country = $8,
      province = $9,
      city = $10,
      address = $11,
      phone = $12,
      email = $13,
      cuit_cuil = $14,
      updated_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [
      userId,
      verificationId,
      input.fullName,
      input.documentType,
      input.documentNumber,
      input.birthDate,
      input.nationality,
      input.country,
      input.province,
      input.city,
      input.address ?? null,
      input.phone,
      input.email,
      input.cuitCuil ?? null
    ]
  );
  return result.rows[0] ?? null;
}

export async function upsertIdentityDocument(input: {
  verificationId: string;
  type: IdentityDocumentType;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
}) {
  const result = await query(
    `INSERT INTO identity_documents
      (identity_verification_id, type, file_name, file_path, mime_type, file_size, checksum_sha256)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (identity_verification_id, type) DO UPDATE SET
      file_name = EXCLUDED.file_name,
      file_path = EXCLUDED.file_path,
      mime_type = EXCLUDED.mime_type,
      file_size = EXCLUDED.file_size,
      checksum_sha256 = EXCLUDED.checksum_sha256,
      uploaded_at = now()
     RETURNING *`,
    [input.verificationId, input.type, input.fileName, input.filePath, input.mimeType, input.fileSize, input.checksumSha256]
  );
  return result.rows[0];
}

export async function submitVerification(userId: string, verificationId: string, input: { declarationText: string; declarationVersion: string; requestHash: string; expiresAt: Date }, context: Context) {
  const result = await query(
    `UPDATE identity_verifications SET
      status = 'IN_REVIEW',
      declaration_accepted = true,
      declaration_text = $3,
      declaration_version = $4,
      request_hash = $5,
      submitted_at = now(),
      expires_at = $6,
      ip_address = $7,
      user_agent = $8,
      updated_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [userId, verificationId, input.declarationText, input.declarationVersion, input.requestHash, input.expiresAt, context.ipAddress ?? null, context.userAgent ?? null]
  );
  const verification = result.rows[0] ?? null;
  return verification ? getVerificationById(verificationId) : null;
}

export async function approveVerification(adminUserId: string, verificationId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE identity_verifications SET
        status = 'VERIFIED',
        verified_at = now(),
        reviewed_at = now(),
        reviewed_by = $2,
        rejection_reason = NULL,
        updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [verificationId, adminUserId]
    );
    const verification = result.rows[0] ?? null;
    if (verification) {
      await client.query("UPDATE users SET verification_status = 'VERIFIED', updated_at = now() WHERE id = $1", [verification.user_id]);
    }
    await client.query("COMMIT");
    return verification ? getVerificationById(verificationId) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectVerification(adminUserId: string, verificationId: string, reason: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE identity_verifications SET
        status = 'REJECTED',
        reviewed_at = now(),
        reviewed_by = $2,
        rejection_reason = $3,
        updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [verificationId, adminUserId, reason]
    );
    const verification = result.rows[0] ?? null;
    if (verification) {
      await client.query("UPDATE users SET verification_status = 'REJECTED', updated_at = now() WHERE id = $1", [verification.user_id]);
    }
    await client.query("COMMIT");
    return verification ? getVerificationById(verificationId) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setUserVerificationStatus(userId: string, status: IdentityStatus) {
  await query("UPDATE users SET verification_status = $2, updated_at = now() WHERE id = $1", [userId, status]);
}

export async function listVerifications(status?: IdentityStatus) {
  const result = await query(
    `SELECT iv.*, u.email AS user_email, u.full_name AS user_full_name,
      COALESCE(json_agg(idoc.*) FILTER (WHERE idoc.id IS NOT NULL), '[]') AS documents
     FROM identity_verifications iv
     JOIN users u ON u.id = iv.user_id
     LEFT JOIN identity_documents idoc ON idoc.identity_verification_id = iv.id
     WHERE ($1::text IS NULL OR iv.status = $1)
     GROUP BY iv.id, u.email, u.full_name
     ORDER BY iv.updated_at DESC
     LIMIT 200`,
    [status ?? null]
  );
  return result.rows;
}
