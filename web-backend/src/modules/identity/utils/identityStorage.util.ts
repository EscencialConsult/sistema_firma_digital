import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../../config/env.js";
import { AppError } from "../../../utils/AppError.js";
import { sha256 } from "../../../utils/crypto.js";
import type { IdentityDocumentType } from "../identity.types.js";
import { localFileStorageProvider } from "./fileStorageProvider.util.js";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function hasValidImageSignature(file: Express.Multer.File, extension: string) {
  const buffer = file.buffer;
  if ((extension === ".jpg" || extension === ".jpeg") && file.mimetype === "image/jpeg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === ".png" && file.mimetype === "image/png") {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === ".webp" && file.mimetype === "image/webp") {
    return buffer.length > 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export function validateIdentityFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    throw new AppError(400, "INVALID_IDENTITY_FILE_TYPE", "Formato invalido. Solo se aceptan JPG, PNG o WEBP.");
  }
  if (file.size > config.identityMaxFileMb * 1024 * 1024) {
    throw new AppError(400, "IDENTITY_FILE_TOO_LARGE", `El archivo supera el maximo de ${config.identityMaxFileMb} MB.`);
  }
  if (!hasValidImageSignature(file, extension)) {
    throw new AppError(400, "INVALID_IDENTITY_FILE_SIGNATURE", "El contenido del archivo no coincide con el formato declarado.");
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
