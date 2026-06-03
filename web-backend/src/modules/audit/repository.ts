import { query } from "../../database/pool.js";
import type { AuditLogInput } from "./types.js";

export async function createAuditLog(input: AuditLogInput) {
  const result = await query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, document_hash, ip_address, user_agent, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      input.userId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.documentHash ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.metadata ?? {}
    ]
  );
  return result.rows[0];
}

export async function listAuditLogsByDocument(documentId: string) {
  const result = await query(
    `SELECT * FROM audit_logs
     WHERE entity_id = $1 OR metadata->>'documentId' = $1
     ORDER BY created_at DESC`,
    [documentId]
  );
  return result.rows;
}

export async function listRecentAuditLogs(limit = 100) {
  const result = await query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1", [limit]);
  return result.rows;
}

export async function listAuditLogsForUser(userId: string, limit = 100) {
  const result = await query(
    `SELECT a.*
     FROM audit_logs a
     LEFT JOIN documents d ON d.id = a.entity_id OR d.id::text = a.metadata->>'documentId'
     WHERE a.user_id = $1 OR d.owner_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}
