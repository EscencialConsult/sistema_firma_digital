import { Router } from "express";
import path from "node:path";
import { config } from "../../config/env.js";
import { authenticate, authorize } from "../../middlewares/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { query } from "../../database/pool.js";
import { identityController } from "../identity/identity.controller.js";
import { scopedDocumentWhere, scopedUserWhere } from "./scope.js";

export const adminRoutes = Router();

adminRoutes.get("/stats", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
  const userParams: unknown[] = [];
  const userScope = scopedUserWhere(req.user!, "u", userParams);
  const documentParams: unknown[] = [];
  const documentScope = scopedDocumentWhere(req.user!, "u", documentParams);
  const identityParams: unknown[] = [];
  const identityScope = scopedUserWhere(req.user!, "u", identityParams);
  const organizationParams: unknown[] = [];
  const organizationScope = req.user!.role === "ADMIN"
    ? ""
    : req.user!.organizationId
      ? (organizationParams.push(req.user!.organizationId), `WHERE o.id = $${organizationParams.length}`)
      : "WHERE false";

  const [users, documents, requests, identityPending, organizations] = await Promise.all([
    query(`SELECT count(*)::int AS count FROM users u WHERE true ${userScope}`, userParams),
    query(`SELECT count(*)::int AS count FROM documents d JOIN users u ON u.id = d.owner_id WHERE true ${documentScope}`, documentParams),
    query(`SELECT count(*)::int AS count FROM signature_requests sr JOIN documents d ON d.id = sr.document_id JOIN users u ON u.id = d.owner_id WHERE true ${documentScope}`, documentParams),
    query(`SELECT count(*)::int AS count FROM identity_verifications iv JOIN users u ON u.id = iv.user_id WHERE iv.status IN ('PENDING', 'IN_REVIEW') ${identityScope}`, identityParams),
    query(`SELECT count(*)::int AS count FROM organizations o ${organizationScope}`, organizationParams)
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

adminRoutes.get("/users", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
  const params: unknown[] = [];
  const scope = scopedUserWhere(req.user!, "u", params);
  const result = await query(
    `SELECT id, email, full_name, role, verification_status, certificate_status, created_at
     FROM users u
     WHERE true ${scope}
     ORDER BY created_at DESC`,
    params
  );
  res.json({ data: result.rows });
}));

adminRoutes.get("/users/:id", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const userParams: unknown[] = [userId];
  const userScope = scopedUserWhere(req.user!, "u", userParams);
  const [userRes, documentsRes, certificatesRes, identityRes] = await Promise.all([
    query(
      `SELECT id, email, full_name, role, verification_status, certificate_status, created_at
       FROM users u
       WHERE id = $1 ${userScope}`,
      userParams
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

adminRoutes.get("/documents", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
  const params: unknown[] = [];
  const scope = scopedDocumentWhere(req.user!, "u", params);
  const result = await query(
    `SELECT d.id, d.title, d.status, d.created_at, d.updated_at, u.email AS owner_email
     FROM documents d
     JOIN users u ON u.id = d.owner_id
     WHERE true ${scope}
     ORDER BY d.updated_at DESC`,
    params
  );
  res.json({ data: result.rows });
}));

adminRoutes.get("/identity-verifications", identityController.adminList);
adminRoutes.get("/identity-verifications/:id", identityController.adminGet);
adminRoutes.get("/identity-verifications/:id/documents/:docId", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
  const { id: verificationId, docId } = req.params;
  const params: unknown[] = [docId, verificationId];
  const scope = scopedUserWhere(req.user!, "u", params);
  const result = await query(
    `SELECT idoc.file_name, idoc.mime_type
     FROM identity_documents idoc
     JOIN identity_verifications iv ON iv.id = idoc.identity_verification_id
     JOIN users u ON u.id = iv.user_id
     WHERE idoc.id = $1 AND idoc.identity_verification_id = $2 ${scope}`,
    params
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
