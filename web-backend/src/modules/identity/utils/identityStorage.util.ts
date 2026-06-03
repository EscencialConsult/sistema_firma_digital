import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config/env.js";
import { AppError } from "../../../utils/AppError.js";
import { sha256 } from "../../../utils/crypto.js";
import type { IdentityDocumentType } from "../identity.types.js";
import { localFileStorageProvider } from "./fileStorageProvider.util.js";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function validateIdentityFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    throw new AppError(400, "INVALID_IDENTITY_FILE_TYPE", "Formato invalido. Solo se aceptan JPG, PNG o WEBP.");
  }
  if (file.size > config.identityMaxFileMb * 1024 * 1024) {
    throw new AppError(400, "IDENTITY_FILE_TOO_LARGE", `El archivo supera el maximo de ${config.identityMaxFileMb} MB.`);
  }
}

export async function storeIdentityFile(file: Express.Multer.File, verificationId: string, type: IdentityDocumentType) {
  validateIdentityFile(file);
  const extension = path.extname(file.originalname).toLowerCase();
  const safeBaseName = file.originalname
    .replace(extension, "")
    .replace(/[^\w.\- ]+/g, "_")
    .slice(0, 80);
  const fileName = `${type.toLowerCase()}_${Date.now()}_${safeBaseName}${extension}`;
  const folder = path.resolve(config.identityUploadDir, verificationId);
  const filePath = path.join(folder, fileName);
  await fs.mkdir(folder, { recursive: true });
  await localFileStorageProvider.upload(file.buffer, filePath);
  return {
    fileName,
    filePath,
    mimeType: file.mimetype,
    fileSize: file.size,
    checksumSha256: sha256(file.buffer)
  };
}
