import { query } from "../../database/pool.js";

export async function createConformity(input: {
  documentId: string;
  userId?: string;
  email: string;
  acceptanceText: string;
  documentHash: string;
  documentVersion: number;
  ipAddress?: string;
  userAgent?: string;
}) {
  const result = await query(
    `INSERT INTO conformity_acceptances
      (document_id, user_id, email, acceptance_text, document_hash, document_version, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [input.documentId, input.userId ?? null, input.email, input.acceptanceText, input.documentHash, input.documentVersion, input.ipAddress ?? null, input.userAgent ?? null]
  );
  return result.rows[0];
}

export async function listConformityAcceptances(email: string) {
  const result = await query(
    `SELECT ca.id, ca.document_id, ca.acceptance_text, ca.document_hash, ca.document_version, ca.ip_address, ca.created_at,
            d.title AS document_title
     FROM conformity_acceptances ca
     JOIN documents d ON d.id = ca.document_id
     WHERE lower(ca.email) = lower($1)
     ORDER BY ca.created_at DESC`,
    [email]
  );
  return result.rows;
}

