import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";
import { sha256 } from "../../utils/crypto.js";

export async function storeUploadedPdf(file: Express.Multer.File, documentId: string, version: number) {
  if (file.mimetype !== "application/pdf") {
    throw new Error("Solo se aceptan archivos PDF.");
  }
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

