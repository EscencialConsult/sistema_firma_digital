import { Router } from "express";
import path from "node:path";
import { config } from "../../config/env.js";
import { authenticate, authorize } from "../../middlewares/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { query } from "../../database/pool.js";
import { identityController } from "../identity/identity.controller.js";

export const adminRoutes = Router();

adminRoutes.get("/stats", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (_req, res) => {
  const [users, documents, requests, identityPending, organizations] = await Promise.all([
    query("SELECT count(*)::int AS count FROM users"),
    query("SELECT count(*)::int AS count FROM documents"),
    query("SELECT count(*)::int AS count FROM signature_requests"),
    query("SELECT count(*)::int AS count FROM identity_verifications WHERE status IN ('PENDING', 'IN_REVIEW')"),
    query("SELECT count(*)::int AS count FROM organizations")
  ]);
  res.json({
    data: {
      users: users.rows[0].count,
      documents: documents.rows[0].count,
      signatureRequests: requests.rows[0].count,
      identityPending: identityPending.rows[0].count,
      organizations: organizations.rows[0].count
    }
  });
}));

adminRoutes.get("/users", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT id, email, full_name, role, verification_status, certificate_status, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  res.json({ data: result.rows });
}));

adminRoutes.get("/users/:id", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const [userRes, documentsRes, certificatesRes, identityRes] = await Promise.all([
    query(
      `SELECT id, email, full_name, role, verification_status, certificate_status, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    ),
    query(
      `SELECT id, title, status, created_at
       FROM documents
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [userId]
    ),
    query(
      `SELECT id, label, status, issuer, valid_to
       FROM certificates
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    ),
    query(
      `SELECT id, status, document_type, document_number, submitted_at, rejection_reason
       FROM identity_verifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )
  ]);

  if (!userRes.rows.length) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json({
    data: {
      user: userRes.rows[0],
      documents: documentsRes.rows,
      certificates: certificatesRes.rows,
      identity: identityRes.rows[0] || null
    }
  });
}));

adminRoutes.get("/documents", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT d.id, d.title, d.status, d.created_at, d.updated_at, u.email AS owner_email
     FROM documents d
     JOIN users u ON u.id = d.owner_id
     ORDER BY d.updated_at DESC`
  );
  res.json({ data: result.rows });
}));

adminRoutes.get("/identity-verifications", identityController.adminList);
adminRoutes.get("/identity-verifications/:id", identityController.adminGet);
adminRoutes.get("/identity-verifications/:id/documents/:docId", authenticate, authorize("ADMIN"), asyncHandler(async (req, res) => {
  const { id: verificationId, docId } = req.params;
  const result = await query(
    `SELECT file_name, mime_type FROM identity_documents 
     WHERE id = $1 AND identity_verification_id = $2`,
    [docId, verificationId]
  );
  if (!result.rows.length) {
    res.status(404).json({ error: "Documento no encontrado" });
    return;
  }
  const doc = result.rows[0];
  const absolutePath = path.resolve(config.identityUploadDir, verificationId, doc.file_name);
  res.setHeader("Content-Type", doc.mime_type);
  res.sendFile(absolutePath);
}));
adminRoutes.post("/identity-verifications/:id/approve", identityController.adminApprove);
adminRoutes.post("/identity-verifications/:id/reject", identityController.adminReject);
