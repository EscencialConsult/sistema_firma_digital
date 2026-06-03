import crypto from "node:crypto";
import { query } from "../../database/pool.js";
import { AppError } from "../../utils/AppError.js";
import { auditService } from "../audit/service.js";
import { createDocumentWithVersion, deleteDocument, getDocument, listDocuments } from "./repository.js";
import { storeUploadedPdf } from "./storage.js";

export const documentService = {
  async create(userId: string, input: { title: string }, file: Express.Multer.File, context: { ipAddress?: string; userAgent?: string }) {
    const documentId = crypto.randomUUID();
    const fileData = await storeUploadedPdf(file, documentId, 1);
    const document = await createDocumentWithVersion(userId, { id: documentId, ...input }, fileData);
    await auditService.record({
      userId,
      action: "DOCUMENT_UPLOADED",
      entityType: "document",
      entityId: document.id,
      documentHash: document.current_version.sha256_hash,
      ...context
    });
    return document;
  },
  list: listDocuments,
  async get(userId: string, id: string) {
    const document: any = await getDocument(userId, id);
    if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");
    
    const requestsResult = await query(
      `SELECT id, signer_email, signer_name, signing_order, status, sent_at, viewed_at, signed_at, expires_at 
       FROM signature_requests 
       WHERE document_id = $1 
       ORDER BY signing_order ASC, created_at ASC`,
      [id]
    );
    document.signature_requests = requestsResult.rows;
    return document;
  },
  async remove(userId: string, id: string) {
    const removed = await deleteDocument(userId, id);
    if (!removed) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");
    return { ok: true };
  }
};

