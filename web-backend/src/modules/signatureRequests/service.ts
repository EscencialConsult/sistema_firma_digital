import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { config } from "../../config/env.js";
import { query } from "../../database/pool.js";
import { sha256 } from "../../utils/crypto.js";
import { generateP12Certificate } from "../../utils/certGenerator.js";
import { AppError } from "../../utils/AppError.js";
import { secureToken } from "../../utils/crypto.js";
import { auditService } from "../audit/service.js";
import { findPublicUserByEmail } from "../auth/repository.js";
import { getDocument, getDocumentById } from "../documents/repository.js";
import { createSignature, createSignatureRequests, findRequestByToken, listSignatureRequestsForUser, markRejected, markSigned, markViewed, updateDocumentCompletion } from "./repository.js";

export const signatureRequestService = {
  listForUser(email: string) {
    return listSignatureRequestsForUser(email);
  },

  async sendDocument(userId: string, documentId: string, input: { signers: Array<{ email: string; name?: string; signingOrder?: number }>; expiresInDays: number }, context: { ipAddress?: string; userAgent?: string }) {
    const document = await getDocument(userId, documentId);
    if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");
    const tokens = input.signers.map(() => ({
      token: secureToken(),
      expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    }));
    const requests = await createSignatureRequests(documentId, input.signers, tokens);
    await auditService.record({ userId, action: "DOCUMENT_SENT", entityType: "document", entityId: documentId, documentHash: document.current_version?.sha256_hash, ...context, metadata: { signers: input.signers.length } });
    return requests;
  },

  async getByToken(token: string) {
    const request = await findRequestByToken(token);
    if (!request) throw new AppError(404, "SIGNATURE_REQUEST_NOT_FOUND", "Solicitud de firma no encontrada o vencida.");
    return request;
  },

  async view(token: string, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getByToken(token);
    const updated = await markViewed(request.id);
    await auditService.record({ action: "DOCUMENT_VIEWED", entityType: "signature_request", entityId: request.id, documentHash: request.current_version?.sha256_hash, ...context, metadata: { documentId: request.document_id, signerEmail: request.signer_email } });
    return updated;
  },

  async getById(id: string, email: string) {
    const result = await query(
      `SELECT sr.*, row_to_json(d.*) AS document, row_to_json(v.*) AS current_version,
              EXISTS(SELECT 1 FROM conformity_acceptances ca WHERE ca.signature_request_id = sr.id) AS accepted_conformity
       FROM signature_requests sr
       JOIN documents d ON d.id = sr.document_id
       LEFT JOIN document_versions v ON v.id = d.current_version_id
       WHERE sr.id = $1 AND lower(sr.signer_email) = lower($2)`,
      [id, email]
    );
    const request = result.rows[0] ?? null;
    if (!request) throw new AppError(404, "SIGNATURE_REQUEST_NOT_FOUND", "Solicitud de firma no encontrada o no tienes permisos sobre ella.");
    return request;
  },

  async executeSignature(request: any, input: { signatureType: string; certificateId?: string; metadata?: Record<string, unknown> }, context: { ipAddress?: string; userAgent?: string }) {
    try {
      if (request.status === "SIGNED") throw new AppError(409, "ALREADY_SIGNED", "La solicitud ya fue firmada.");
      const signerUser = await findPublicUserByEmail(request.signer_email);
      if (signerUser && signerUser.verification_status !== "VERIFIED") {
        throw new AppError(403, "IDENTITY_NOT_VERIFIED", "Para firmar, la identidad del firmante debe estar verificada.");
      }

      const conformityCheck = await query(
        "SELECT id FROM conformity_acceptances WHERE signature_request_id = $1 LIMIT 1",
        [request.id]
      );
      if (conformityCheck.rowCount === 0) {
        throw new AppError(403, "CONFORMITY_REQUIRED", "Debe aceptar la conformidad del documento antes de poder firmarlo.");
      }

      let p12Buffer: Buffer;
      let p12Password = "password";
      let certificateDbId: string | undefined = input.certificateId;

      if (signerUser && signerUser.verification_status === "VERIFIED") {
        const userCertResult = await query(
          `SELECT * FROM certificates WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [signerUser.id]
        );
        let userCert = userCertResult.rows[0];
        if (!userCert) {
          const certFolder = path.resolve(config.uploadDir, "certificates");
          const generatedCert = await generateP12Certificate(
            signerUser.id,
            signerUser.full_name || "Usuario Verificado",
            signerUser.email,
            certFolder,
            p12Password
          );
          const newCertResult = await query(
            `INSERT INTO certificates
              (user_id, label, type, issuer, subject, serial_number, valid_from, valid_to, fingerprint_sha256, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              signerUser.id,
              `Certificado Personal - ${signerUser.full_name}`,
              "P12",
              "Escencial CA",
              `CN=${signerUser.full_name}, O=Escencial, E=${signerUser.email}`,
              generatedCert.serialNumber,
              generatedCert.validFrom,
              generatedCert.validTo,
              generatedCert.fingerprintSha256,
              { storagePath: generatedCert.storagePath, password: p12Password }
            ]
          );
          userCert = newCertResult.rows[0];
        }
        p12Buffer = await fsPromises.readFile(userCert.metadata.storagePath);
        p12Password = userCert.metadata.password || "password";
        certificateDbId = userCert.id;
      } else {
        const certFolder = path.resolve(config.uploadDir, "certificates");
        const generatedCert = await generateP12Certificate(
          `temp_${Date.now()}`,
          request.signer_name || "Firmante Invitado",
          request.signer_email,
          certFolder,
          p12Password
        );
        p12Buffer = await fsPromises.readFile(generatedCert.storagePath);
      }

      const pdfBytes = await fsPromises.readFile(request.current_version.storage_path);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const metaX = Number(input.metadata?.x ?? 50);
      const metaY = Number(input.metadata?.y ?? 50);
      const metaW = Number(input.metadata?.width ?? 180);
      const metaH = Number(input.metadata?.height ?? 60);
      const metaPageNum = Number(input.metadata?.page ?? 1);

      const pageIndex = Math.max(0, metaPageNum - 1);
      const totalPages = pdfDoc.getPageCount();
      const targetPage = pdfDoc.getPage(pageIndex < totalPages ? pageIndex : totalPages - 1);

      targetPage.drawRectangle({
        x: metaX,
        y: metaY,
        width: metaW,
        height: metaH,
        color: rgb(0.96, 0.98, 0.96),
        borderColor: rgb(0.06, 0.46, 0.24),
        borderWidth: 1.5,
      });

      targetPage.drawText("FIRMA DIGITAL SEGURA", {
        x: metaX + 8,
        y: metaY + metaH - 12,
        size: 7,
        font: helveticaBold,
        color: rgb(0.06, 0.46, 0.24),
      });

      targetPage.drawText(`Firmante: ${request.signer_name || request.signer_email}`, {
        x: metaX + 8,
        y: metaY + metaH - 24,
        size: 6.5,
        font: helveticaFont,
        color: rgb(0.1, 0.1, 0.1),
      });

      const dateStr = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
      targetPage.drawText(`Fecha: ${dateStr}`, {
        x: metaX + 8,
        y: metaY + metaH - 34,
        size: 6,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      targetPage.drawText(`IP: ${context.ipAddress || "127.0.0.1"}`, {
        x: metaX + 8,
        y: metaY + metaH - 44,
        size: 6,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      targetPage.drawText(`ID: ${request.id.slice(0, 8)}...`, {
        x: metaX + 8,
        y: metaY + metaH - 54,
        size: 5.5,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      const pdfWithVisualBytes = await pdfDoc.save();

      const pdfDocForSign = await PDFDocument.load(pdfWithVisualBytes);
      pdflibAddPlaceholder({
        pdfDoc: pdfDocForSign,
        reason: "Firma Digital de Documento",
        contactInfo: request.signer_email,
        name: request.signer_name || request.signer_email,
        location: "Firma Digital Portal",
        signatureLength: 8192,
      });
      const pdfWithPlaceholder = await pdfDocForSign.save();

      const p12Signer = new P12Signer(p12Buffer, { passphrase: p12Password });
      const signPdf = new SignPdf();
      const signedPdfBuffer = await signPdf.sign(pdfWithPlaceholder, p12Signer);

      const nextVersionNumber = Number(request.current_version.version_number) + 1;
      const documentId = request.document_id;
      const folder = path.resolve(config.uploadDir, documentId);
      await fsPromises.mkdir(folder, { recursive: true });

      const safeName = request.current_version.file_name.replace(/[^\w.\- ]+/g, "_");
      const storagePath = path.join(folder, `v${nextVersionNumber}_signed_${safeName}`);
      await fsPromises.writeFile(storagePath, signedPdfBuffer);

      const newHash = sha256(signedPdfBuffer);

      const versionResult = await query(
        `INSERT INTO document_versions
          (document_id, version_number, file_name, storage_path, mime_type, size_bytes, sha256_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          documentId,
          nextVersionNumber,
          `signed_${request.current_version.file_name}`,
          storagePath,
          "application/pdf",
          signedPdfBuffer.length,
          newHash
        ]
      );
      const newVersion = versionResult.rows[0];

      await query("UPDATE documents SET current_version_id = $2 WHERE id = $1", [documentId, newVersion.id]);

      const signature = await createSignature({
        documentId: request.document_id,
        requestId: request.id,
        signerEmail: request.signer_email,
        signatureType: input.signatureType,
        certificateId: certificateDbId,
        documentHash: newHash,
        ...context,
        metadata: input.metadata ?? {}
      });

      await markSigned(request.id);
      const documentStatus = await updateDocumentCompletion(request.document_id);
      await auditService.record({ action: "DOCUMENT_SIGNED", entityType: "signature_request", entityId: request.id, documentHash: newHash, ...context, metadata: { documentId: request.document_id, signerEmail: request.signer_email, signatureType: input.signatureType } });
      if (documentStatus === "COMPLETED") {
        await auditService.record({ action: "DOCUMENT_COMPLETED", entityType: "document", entityId: request.document_id, documentHash: newHash, ...context });
      }
      return signature;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[executeSignature] Error inesperado:", msg, {
        requestId: request.id,
        signerEmail: request.signer_email,
        documentId: request.document_id,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new AppError(500, "SIGN_EXECUTION_FAILED", "Error al ejecutar la firma digital. Revise los logs del servidor.");
    }
  },

  async sign(token: string, input: { signatureType: string; certificateId?: string; metadata?: Record<string, unknown> }, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getByToken(token);
    return this.executeSignature(request, input, context);
  },

  async signById(id: string, email: string, input: { signatureType: string; certificateId?: string; metadata?: Record<string, unknown> }, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getById(id, email);
    return this.executeSignature(request, input, context);
  },

  async conformityById(id: string, email: string, input: { acceptanceText: string }, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getById(id, email);
    if (request.status === "SIGNED") throw new AppError(409, "ALREADY_SIGNED", "El documento ya fue firmado.");

    const result = await query(
      `INSERT INTO conformity_acceptances
        (document_id, signature_request_id, email, acceptance_text, document_hash, document_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.document_id,
        request.id,
        request.signer_email,
        input.acceptanceText,
        request.current_version.sha256_hash,
        request.current_version.version_number,
        context.ipAddress ?? null,
        context.userAgent ?? null
      ]
    );

    await auditService.record({
      action: "DOCUMENT_ACCEPTED",
      entityType: "signature_request",
      entityId: request.id,
      documentHash: request.current_version.sha256_hash,
      ...context,
      metadata: { email: request.signer_email, documentId: request.document_id }
    });

    return result.rows[0];
  },

  async acceptConformity(token: string, input: { acceptanceText: string }, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getByToken(token);
    if (request.status === "SIGNED") throw new AppError(409, "ALREADY_SIGNED", "El documento ya fue firmado.");

    const result = await query(
      `INSERT INTO conformity_acceptances
        (document_id, signature_request_id, email, acceptance_text, document_hash, document_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.document_id,
        request.id,
        request.signer_email,
        input.acceptanceText,
        request.current_version.sha256_hash,
        request.current_version.version_number,
        context.ipAddress ?? null,
        context.userAgent ?? null
      ]
    );

    await auditService.record({
      action: "DOCUMENT_ACCEPTED",
      entityType: "signature_request",
      entityId: request.id,
      documentHash: request.current_version.sha256_hash,
      ...context,
      metadata: { email: request.signer_email, documentId: request.document_id }
    });

    return result.rows[0];
  },

  async reject(token: string, reason: string | undefined, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getByToken(token);
    const updated = await markRejected(request.id);
    await auditService.record({ action: "DOCUMENT_REJECTED", entityType: "signature_request", entityId: request.id, documentHash: request.current_version?.sha256_hash, ...context, metadata: { reason, documentId: request.document_id } });
    return updated;
  },

  async rejectById(id: string, email: string, reason: string | undefined, context: { ipAddress?: string; userAgent?: string }) {
    const request = await this.getById(id, email);
    if (request.status === "SIGNED") throw new AppError(409, "ALREADY_SIGNED", "El documento ya fue firmado.");
    const updated = await markRejected(request.id);
    await auditService.record({ action: "DOCUMENT_REJECTED", entityType: "signature_request", entityId: request.id, documentHash: request.current_version?.sha256_hash, ...context, metadata: { reason, documentId: request.document_id } });
    return updated;
  },

  async downloadDocument(user: { id: string; email: string; role: string }, documentId: string) {
    const docResult = await query(
      `SELECT d.*, row_to_json(v.*) AS current_version
       FROM documents d
       LEFT JOIN document_versions v ON v.id = d.current_version_id
       WHERE d.id = $1`,
      [documentId]
    );
    const document = docResult.rows[0] ?? null;
    if (!document?.current_version) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado o no tiene versión actual.");
    }

    const isOwner = document.owner_id === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "ORGANIZATION_ADMIN";

    let isSigner = false;
    if (!isOwner && !isAdmin) {
      const signerCheck = await query(
        `SELECT 1 FROM signature_requests 
         WHERE document_id = $1 AND lower(signer_email) = lower($2) 
         LIMIT 1`,
        [documentId, user.email]
      );
      isSigner = (signerCheck.rowCount ?? 0) > 0;
    }

    if (!isOwner && !isAdmin && !isSigner) {
      throw new AppError(403, "FORBIDDEN", "No tenes permisos para descargar este documento.");
    }

    if (!fs.existsSync(document.current_version.storage_path)) {
      throw new AppError(404, "FILE_NOT_FOUND", "Archivo no encontrado en el servidor.");
    }

    return document.current_version;
  },

  async publicDownload(token: string) {
    const request = await this.getByToken(token);
    if (!fs.existsSync(request.current_version.storage_path)) throw new AppError(404, "FILE_NOT_FOUND", "Archivo no encontrado en storage.");
    return request.current_version;
  },

  async documentAudit(documentId: string) {
    const document = await getDocumentById(documentId);
    if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");
    return auditService.listForDocument(documentId);
  }
};
