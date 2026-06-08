import crypto from "node:crypto";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { config } from "../../config/env.js";
import { query } from "../../database/pool.js";
import { AppError } from "../../utils/AppError.js";
import { sha256 } from "../../utils/crypto.js";
import { detectPkcs11Tokens, Pkcs11Signer, signPdfWithPyhanko } from "../../utils/pkcs11Signer.js";
import { isWindowsCertificateModule, signPdfWithWindowsCertificate } from "../../utils/windowsCertificateSigner.js";
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
  },
  async signOwnDocumentWithPkcs11(
    user: { id: string; email: string; role: string },
    id: string,
    input: { pin?: string; certId?: string; modulePath?: string; slot?: string; metadata?: Record<string, unknown> },
    context: { ipAddress?: string; userAgent?: string }
  ) {
    if (user.role !== "ADMIN" && user.role !== "ORGANIZATION_ADMIN") {
      throw new AppError(403, "ADMIN_REQUIRED", "Solo administradores pueden firmar documentos propios con PKCS#11.");
    }

    const document: any = await getDocument(user.id, id);
    if (!document?.current_version) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");

    const pdfBytes = await fsPromises.readFile(document.current_version.storage_path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const metaX = Number(input.metadata?.x ?? 50);
    const metaY = Number(input.metadata?.y ?? 50);
    const metaW = Number(input.metadata?.width ?? 190);
    const metaH = Number(input.metadata?.height ?? 64);
    const metaPageNum = Number(input.metadata?.page ?? 1);

    const pageIndex = Math.max(0, metaPageNum - 1);
    const totalPages = pdfDoc.getPageCount();
    const targetPage = pdfDoc.getPage(pageIndex < totalPages ? pageIndex : totalPages - 1);

    targetPage.drawRectangle({
      x: metaX,
      y: metaY,
      width: metaW,
      height: metaH,
      color: rgb(0.96, 0.98, 1),
      borderColor: rgb(0.05, 0.28, 0.62),
      borderWidth: 1.5
    });
    targetPage.drawText("FIRMA DIGITAL PKCS#11", {
      x: metaX + 8,
      y: metaY + metaH - 13,
      size: 7,
      font: helveticaBold,
      color: rgb(0.05, 0.28, 0.62)
    });
    targetPage.drawText(`Admin: ${user.email}`, {
      x: metaX + 8,
      y: metaY + metaH - 27,
      size: 6.5,
      font: helveticaFont,
      color: rgb(0.1, 0.1, 0.1)
    });
    targetPage.drawText(`Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`, {
      x: metaX + 8,
      y: metaY + metaH - 40,
      size: 6,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3)
    });
    targetPage.drawText(`Token: ${input.certId ?? config.pkcs11CertId ?? "configurado"}`, {
      x: metaX + 8,
      y: metaY + metaH - 53,
      size: 5.5,
      font: helveticaFont,
      color: rgb(0.45, 0.45, 0.45)
    });

    const pdfWithVisualBytes = await pdfDoc.save();
    const nextVersionNumber = Number(document.current_version.version_number) + 1;
    const folder = path.resolve(config.uploadDir, document.id);
    await fsPromises.mkdir(folder, { recursive: true });

    const safeName = document.current_version.file_name.replace(/[^\w.\- ]+/g, "_");
    const storagePath = path.join(folder, `v${nextVersionNumber}_pkcs11_signed_${safeName}`);
    const unsignedVisualPath = path.join(folder, `v${nextVersionNumber}_pkcs11_visual_${safeName}`);
    await fsPromises.writeFile(unsignedVisualPath, pdfWithVisualBytes);

    let signedPdfBuffer: Buffer;
    if (isWindowsCertificateModule(input.modulePath)) {
      if (!input.certId) throw new AppError(400, "WINDOWS_CERT_REQUIRED", "Selecciona un certificado de Windows para firmar.");
      try {
        await signPdfWithWindowsCertificate(unsignedVisualPath, storagePath, input.certId, user.email);
        signedPdfBuffer = await fsPromises.readFile(storagePath);
      } finally {
        await fsPromises.rm(unsignedVisualPath, { force: true });
      }
    } else {
      const pin = input.pin;
      if (!pin) throw new AppError(400, "PKCS11_PIN_REQUIRED", "Ingresa el PIN del token para firmar.");
      try {
        await signPdfWithPyhanko({
          pin,
          modulePath: input.modulePath ?? config.pkcs11ModulePath ?? "",
          certId: input.certId,
          slot: input.slot,
          inputPdf: unsignedVisualPath,
          outputPdf: storagePath,
          signerName: user.email,
          contactInfo: user.email,
          page: metaPageNum,
          x: metaX,
          y: metaY,
          width: metaW,
          height: metaH
        });
        signedPdfBuffer = await fsPromises.readFile(storagePath);
      } catch {
        const pdfDocForSign = await PDFDocument.load(pdfWithVisualBytes);
        pdflibAddPlaceholder({
          pdfDoc: pdfDocForSign,
          reason: "Firma Digital PKCS#11",
          contactInfo: user.email,
          name: user.email,
          location: "Firma Digital Portal",
          signatureLength: 16384
        });

        const pdfWithPlaceholder = await pdfDocForSign.save();
        const signer = new Pkcs11Signer({ pin, certId: input.certId, modulePath: input.modulePath });
        await signer.loadCertificate();
        signedPdfBuffer = await new SignPdf().sign(pdfWithPlaceholder, signer);
        await fsPromises.writeFile(storagePath, signedPdfBuffer);
      } finally {
        await fsPromises.rm(unsignedVisualPath, { force: true });
      }
    }

    const newHash = sha256(signedPdfBuffer);
    const versionResult = await query(
      `INSERT INTO document_versions
        (document_id, version_number, file_name, storage_path, mime_type, size_bytes, sha256_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        document.id,
        nextVersionNumber,
        `pkcs11_signed_${document.current_version.file_name}`,
        storagePath,
        "application/pdf",
        signedPdfBuffer.length,
        newHash
      ]
    );
    const newVersion = versionResult.rows[0];

    await query("UPDATE documents SET current_version_id = $2, status = 'COMPLETED', updated_at = now() WHERE id = $1", [document.id, newVersion.id]);
    const signatureResult = await query(
      `INSERT INTO signatures
        (document_id, user_id, signer_email, signature_type, document_hash, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        document.id,
        user.id,
        user.email,
        "PKCS11",
        newHash,
        context.ipAddress ?? null,
        context.userAgent ?? null,
        { ...(input.metadata ?? {}), certId: input.certId ?? config.pkcs11CertId ?? null, slot: input.slot ?? null }
      ]
    );

    await auditService.record({
      userId: user.id,
      action: "DOCUMENT_SIGNED",
      entityType: "document",
      entityId: document.id,
      documentHash: newHash,
      ...context
    });

    return { document: { ...document, status: "COMPLETED", current_version: newVersion }, signature: signatureResult.rows[0] };
  },
  async detectPkcs11Tokens(user: { role: string }, pin?: string) {
    if (user.role !== "ADMIN" && user.role !== "ORGANIZATION_ADMIN") {
      throw new AppError(403, "ADMIN_REQUIRED", "Solo administradores pueden detectar tokens PKCS#11.");
    }
    return detectPkcs11Tokens(pin);
  }
};
