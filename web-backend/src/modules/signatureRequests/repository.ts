import { pool, query } from "../../database/pool.js";
import { sha256 } from "../../utils/crypto.js";
import { markDocumentSent } from "../documents/repository.js";

export async function createSignatureRequests(documentId: string, signers: Array<{ email: string; name?: string; signingOrder?: number }>, tokenPairs: Array<{ token: string; expiresAt: Date }>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = [];
    for (let index = 0; index < signers.length; index += 1) {
      const signer = signers[index];
      const token = tokenPairs[index];
      const result = await client.query(
        `INSERT INTO signature_requests
          (document_id, signer_email, signer_name, signing_order, access_token_hash, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, document_id, signer_email, signer_name, signing_order, status, sent_at, expires_at`,
        [documentId, signer.email, signer.name ?? null, signer.signingOrder ?? null, sha256(token.token), token.expiresAt]
      );
      rows.push({ ...result.rows[0], accessToken: token.token });
    }
    await markDocumentSent(documentId);
    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSignatureRequestsForUser(email: string) {
  const result = await query(
    `SELECT sr.id, sr.document_id, sr.signer_email, sr.signer_name, sr.signing_order,
            sr.status, sr.sent_at, sr.viewed_at, sr.signed_at, sr.expires_at, sr.created_at,
            d.title AS document_title
     FROM signature_requests sr
     JOIN documents d ON d.id = sr.document_id
     WHERE lower(sr.signer_email) = lower($1)
     ORDER BY sr.created_at DESC`,
    [email]
  );
  return result.rows;
}

export async function findRequestByToken(token: string) {
  const result = await query(
    `SELECT sr.*, row_to_json(d.*) AS document, row_to_json(v.*) AS current_version,
            EXISTS(SELECT 1 FROM conformity_acceptances ca WHERE ca.signature_request_id = sr.id) AS accepted_conformity
     FROM signature_requests sr
     JOIN documents d ON d.id = sr.document_id
     LEFT JOIN document_versions v ON v.id = d.current_version_id
     WHERE sr.access_token_hash = $1 AND sr.expires_at > now()`,
    [sha256(token)]
  );
  return result.rows[0] ?? null;
}

export async function markViewed(requestId: string) {
  const result = await query(
    "UPDATE signature_requests SET status = 'VIEWED', viewed_at = COALESCE(viewed_at, now()) WHERE id = $1 RETURNING *",
    [requestId]
  );
  return result.rows[0];
}

export async function markSigned(requestId: string) {
  const result = await query(
    "UPDATE signature_requests SET status = 'SIGNED', signed_at = now() WHERE id = $1 RETURNING *",
    [requestId]
  );
  return result.rows[0];
}

export async function markRejected(requestId: string) {
  const result = await query(
    "UPDATE signature_requests SET status = 'REJECTED' WHERE id = $1 RETURNING *",
    [requestId]
  );
  return result.rows[0];
}

export async function createSignature(input: {
  documentId: string;
  requestId: string;
  signerEmail: string;
  signatureType: string;
  certificateId?: string;
  documentHash: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await query(
    `INSERT INTO signatures
      (document_id, signature_request_id, signer_email, signature_type, certificate_id, document_hash, ip_address, user_agent, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [input.documentId, input.requestId, input.signerEmail, input.signatureType, input.certificateId ?? null, input.documentHash, input.ipAddress ?? null, input.userAgent ?? null, input.metadata ?? {}]
  );
  return result.rows[0];
}

export async function updateDocumentCompletion(documentId: string) {
  const pending = await query(
    "SELECT count(*)::int AS count FROM signature_requests WHERE document_id = $1 AND status NOT IN ('SIGNED', 'REJECTED', 'EXPIRED')",
    [documentId]
  );
  const signed = await query(
    "SELECT count(*)::int AS count FROM signature_requests WHERE document_id = $1 AND status = 'SIGNED'",
    [documentId]
  );
  const status = pending.rows[0].count === 0 && signed.rows[0].count > 0 ? "COMPLETED" : "PARTIALLY_SIGNED";
  await query("UPDATE documents SET status = $2, updated_at = now() WHERE id = $1", [documentId, status]);
  return status;
}
