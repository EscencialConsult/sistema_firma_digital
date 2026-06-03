import crypto from "node:crypto";
import { pool, query } from "../../database/pool.js";

export async function createDocumentWithVersion(userId: string, input: { id?: string; title: string }, fileData: { fileName: string; storagePath: string; mimeType: string; sizeBytes: number; sha256Hash: string }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const docId = input.id || crypto.randomUUID();
    const document = await client.query(
      `INSERT INTO documents (id, owner_id, title, status)
       VALUES ($1,$2,$3,'DRAFT')
       RETURNING *`,
      [docId, userId, input.title]
    );
    const version = await client.query(
      `INSERT INTO document_versions
        (document_id, version_number, file_name, storage_path, mime_type, size_bytes, sha256_hash)
       VALUES ($1,1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [document.rows[0].id, fileData.fileName, fileData.storagePath, fileData.mimeType, fileData.sizeBytes, fileData.sha256Hash]
    );
    await client.query("UPDATE documents SET current_version_id = $2 WHERE id = $1", [document.rows[0].id, version.rows[0].id]);
    await client.query("COMMIT");
    return { ...document.rows[0], current_version: version.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listDocuments(userId: string) {
  const result = await query(
    `SELECT d.*, v.sha256_hash, v.file_name
     FROM documents d
     LEFT JOIN document_versions v ON v.id = d.current_version_id
     WHERE d.owner_id = $1
     ORDER BY d.updated_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getDocument(userId: string, id: string) {
  const result = await query(
    `SELECT d.*, row_to_json(v.*) AS current_version
     FROM documents d
     LEFT JOIN document_versions v ON v.id = d.current_version_id
     WHERE d.owner_id = $1 AND d.id = $2`,
    [userId, id]
  );
  return result.rows[0] ?? null;
}

export async function getDocumentById(id: string) {
  const result = await query(
    `SELECT d.*, row_to_json(v.*) AS current_version
     FROM documents d
     LEFT JOIN document_versions v ON v.id = d.current_version_id
     WHERE d.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function deleteDocument(userId: string, id: string) {
  const result = await query("DELETE FROM documents WHERE owner_id = $1 AND id = $2 RETURNING id", [userId, id]);
  return (result.rowCount ?? 0) > 0;
}

export async function markDocumentSent(documentId: string) {
  await query("UPDATE documents SET status = 'SENT', updated_at = now() WHERE id = $1", [documentId]);
}
