import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { config } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { sha256 } from "../../utils/crypto.js";

const maxPdfSizeBytes = 50 * 1024 * 1024;

async function validatePdfFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension !== ".pdf" || file.mimetype !== "application/pdf") {
    throw new AppError(400, "INVALID_PDF_FILE_TYPE", "Solo se aceptan archivos PDF.");
  }
  if (file.size > maxPdfSizeBytes) {
    throw new AppError(400, "PDF_FILE_TOO_LARGE", "El archivo PDF supera el maximo de 50 MB.");
  }
  if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AppError(400, "INVALID_PDF_SIGNATURE", "El archivo no tiene una firma PDF valida.");
  }
  await PDFDocument.load(file.buffer).catch(() => {
    throw new AppError(400, "INVALID_PDF_CONTENT", "El archivo PDF no se pudo leer correctamente.");
  });
}

export async function storeUploadedPdf(file: Express.Multer.File, documentId: string, version: number) {
  await validatePdfFile(file);
  const folder = path.resolve(config.uploadDir, documentId);
  await fs.mkdir(folder, { recursive: true });
  const safeName = file.originalname.replace(/[^\w.\- ]+/g, "_");
  const storagePath = path.join(folder, `v${version}_${safeName}`);
  await fs.writeFile(storagePath, file.buffer);
  return {
    fileName: safeName,
    storagePath,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256Hash: sha256(file.buffer)
  };
}
