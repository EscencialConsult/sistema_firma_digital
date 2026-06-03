import { query } from "../../database/pool.js";
import type { AuthUser } from "../../middlewares/authenticate.js";

export async function getDashboardSummary(user: AuthUser) {
  const [documents, pendingSignatures, completedDocuments, rejectedDocuments, recentDocuments, recentActivity] = await Promise.all([
    query("SELECT count(*)::int AS count FROM documents WHERE owner_id = $1", [user.id]),
    query(
      `SELECT count(*)::int AS count
       FROM signature_requests
       WHERE lower(signer_email) = lower($1)
         AND status IN ('PENDING', 'VIEWED')`,
      [user.email]
    ),
    query("SELECT count(*)::int AS count FROM documents WHERE owner_id = $1 AND status = 'COMPLETED'", [user.id]),
    query("SELECT count(*)::int AS count FROM documents WHERE owner_id = $1 AND status = 'REJECTED'", [user.id]),
    query(
      `SELECT d.*, v.sha256_hash, v.file_name,
        (SELECT count(*)::int FROM signature_requests sr WHERE sr.document_id = d.id) AS signers
       FROM documents d
       LEFT JOIN document_versions v ON v.id = d.current_version_id
       WHERE d.owner_id = $1
       ORDER BY d.updated_at DESC
       LIMIT 5`,
      [user.id]
    ),
    query(
      `SELECT a.*
       FROM audit_logs a
       LEFT JOIN documents d ON d.id = a.entity_id OR d.id::text = a.metadata->>'documentId'
       WHERE a.user_id = $1 OR d.owner_id = $1
       ORDER BY a.created_at DESC
       LIMIT 10`,
      [user.id]
    )
  ]);

  return {
    stats: {
      documents: documents.rows[0].count,
      pendingSignatures: pendingSignatures.rows[0].count,
      completedDocuments: completedDocuments.rows[0].count,
      rejectedDocuments: rejectedDocuments.rows[0].count
    },
    recentDocuments: recentDocuments.rows,
    recentActivity: recentActivity.rows
  };
}
