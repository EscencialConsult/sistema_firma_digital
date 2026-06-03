import path from "node:path";
import { config } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { sha256 } from "../../utils/crypto.js";
import { generateP12Certificate } from "../../utils/certGenerator.js";
import { createCertificate } from "../certificates/repository.js";
import { auditService } from "../audit/service.js";
import { REQUIRED_IDENTITY_DOCUMENT_TYPES } from "./identity.constants.js";
import { mapIdentityVerification } from "./mappers/identity.mapper.js";
import {
  approveVerification,
  createIdentityAuditLog,
  createVerification,
  getIdentityAuditLogs,
  getLatestVerification,
  getVerificationById,
  listVerifications,
  rejectVerification,
  setUserVerificationStatus,
  submitVerification,
  updatePersonalData,
  upsertIdentityDocument
} from "./identity.repository.js";
import { storeIdentityFile } from "./utils/identityStorage.util.js";
import type { IdentityDocumentType, IdentityStatus } from "./identity.types.js";

type Context = { ipAddress?: string; userAgent?: string };

const uploadActions: Record<IdentityDocumentType, "IDENTITY_DOCUMENT_FRONT_UPLOADED" | "IDENTITY_DOCUMENT_BACK_UPLOADED" | "IDENTITY_SELFIE_UPLOADED"> = {
  DOCUMENT_FRONT: "IDENTITY_DOCUMENT_FRONT_UPLOADED",
  DOCUMENT_BACK: "IDENTITY_DOCUMENT_BACK_UPLOADED",
  SELFIE: "IDENTITY_SELFIE_UPLOADED"
};

function canEdit(status?: IdentityStatus) {
  return !status || status === "PENDING" || status === "REJECTED";
}

async function requireDraftVerification(userId: string, context: Context) {
  let verification = await getLatestVerification(userId);
  if (verification?.status === "VERIFIED") {
    throw new AppError(409, "IDENTITY_ALREADY_VERIFIED", "La identidad ya esta verificada. Para modificar datos sensibles hay que reiniciar el proceso administrativamente.");
  }
  if (!verification || verification.status === "EXPIRED") {
    verification = await createVerification(userId, context);
    await createIdentityAuditLog({ userId, verificationId: verification.id, action: "IDENTITY_STARTED", context });
  }
  if (!canEdit(verification.status)) {
    throw new AppError(409, "IDENTITY_NOT_EDITABLE", "La verificacion ya esta en revision.");
  }
  return verification;
}

export const identityService = {
  async me(userId: string) {
    const verification = await getLatestVerification(userId);
    if (!verification) return null;
    return mapIdentityVerification({ ...verification, auditLogs: await getIdentityAuditLogs(verification.id) });
  },

  async start(userId: string, context: Context) {
    const current = await getLatestVerification(userId);
    if (current && ["PENDING", "IN_REVIEW", "REJECTED"].includes(current.status)) return mapIdentityVerification(current);
    if (current && current.status === "VERIFIED") {
      throw new AppError(409, "IDENTITY_ALREADY_VERIFIED", "La identidad ya esta verificada.");
    }
    const verification = await createVerification(userId, context);
    await createIdentityAuditLog({ userId, verificationId: verification.id, action: "IDENTITY_STARTED", context });
    await auditService.record({ userId, action: "IDENTITY_VERIFICATION_STARTED", entityType: "identity_verification", entityId: verification.id, ...context });
    return mapIdentityVerification(await getVerificationById(verification.id));
  },

  async updatePersonalData(userId: string, input: Record<string, unknown>, context: Context) {
    const verification = await requireDraftVerification(userId, context);
    const updated = await updatePersonalData(userId, verification.id, input);
    await createIdentityAuditLog({ userId, verificationId: verification.id, action: "IDENTITY_PERSONAL_DATA_UPDATED", context });
    return mapIdentityVerification(await getVerificationById(verification.id));
  },

  async uploadDocument(userId: string, type: IdentityDocumentType, file: Express.Multer.File, context: Context) {
    const verification = await requireDraftVerification(userId, context);
    const stored = await storeIdentityFile(file, verification.id, type);
    const document = await upsertIdentityDocument({ verificationId: verification.id, type, ...stored });
    await createIdentityAuditLog({
      userId,
      verificationId: verification.id,
      action: uploadActions[type],
      context,
      metadata: { fileName: stored.fileName, mimeType: stored.mimeType, fileSize: stored.fileSize, checksumSha256: stored.checksumSha256 }
    });
    return {
      id: document.id,
      type: document.type,
      fileName: document.file_name,
      mimeType: document.mime_type,
      fileSize: Number(document.file_size),
      checksumSha256: document.checksum_sha256,
      uploadedAt: document.uploaded_at
    };
  },

  async submit(userId: string, input: { declarationText: string; declarationVersion: string }, context: Context) {
    const verification = await requireDraftVerification(userId, context);
    const fullVerification = await getLatestVerification(userId);
    const documents = fullVerification?.documents ?? [];
    const types = new Set(documents.map((document: { type: string }) => document.type));
    for (const required of REQUIRED_IDENTITY_DOCUMENT_TYPES) {
      if (!types.has(required)) throw new AppError(400, "IDENTITY_DOCUMENTS_INCOMPLETE", "Faltan imagenes requeridas para enviar la verificacion.");
    }
    if (!fullVerification.full_name || !fullVerification.document_number || !fullVerification.birth_date) {
      throw new AppError(400, "IDENTITY_PERSONAL_DATA_INCOMPLETE", "Faltan datos personales requeridos.");
    }
    const requestHash = sha256(JSON.stringify({
      userId,
      verificationId: verification.id,
      documentNumber: fullVerification.document_number,
      documents: documents.map((document: { type: string; checksum_sha256: string }) => [document.type, document.checksum_sha256]),
      declarationText: input.declarationText,
      declarationVersion: input.declarationVersion
    }));
    const expiresAt = new Date(Date.now() + config.identityExpiresDays * 24 * 60 * 60 * 1000);
    const submitted = await submitVerification(userId, verification.id, { ...input, requestHash, expiresAt }, context);
    await setUserVerificationStatus(userId, "IN_REVIEW");
    await createIdentityAuditLog({ userId, verificationId: verification.id, action: "IDENTITY_DECLARATION_ACCEPTED", context, metadata: { declarationVersion: input.declarationVersion } });
    await createIdentityAuditLog({ userId, verificationId: verification.id, action: "IDENTITY_SUBMITTED", context, metadata: { requestHash } });
    return mapIdentityVerification(submitted);
  },

  async status(userId: string) {
    return mapIdentityVerification(await getLatestVerification(userId));
  },

  async listAdmin(status?: IdentityStatus) {
    const verifications = await listVerifications(status);
    return verifications.map((verification) => mapIdentityVerification(verification));
  },

  async getAdmin(id: string) {
    const verification = await getVerificationById(id);
    if (!verification) throw new AppError(404, "IDENTITY_NOT_FOUND", "Verificacion no encontrada.");
    return mapIdentityVerification({ ...verification, auditLogs: await getIdentityAuditLogs(id) });
  },

  async approve(adminUserId: string, id: string, context: Context) {
    const verification = await approveVerification(adminUserId, id);
    if (!verification) throw new AppError(404, "IDENTITY_NOT_FOUND", "Verificacion no encontrada.");
    
    // Generate certificate for verified user
    const certFolder = path.resolve(config.uploadDir, "certificates");
    const password = "password"; // Secure default password for PKCS12 store
    const generatedCert = await generateP12Certificate(
      verification.user_id,
      verification.full_name || "Usuario Verificado",
      verification.email || "usuario@firma.com",
      certFolder,
      password
    );

    // Save metadata and path to certificates table
    await createCertificate(verification.user_id, {
      label: `Certificado Personal - ${verification.full_name}`,
      type: "P12",
      issuer: "Escencial CA",
      subject: `CN=${verification.full_name}, O=Escencial, E=${verification.email}`,
      serialNumber: generatedCert.serialNumber,
      validFrom: generatedCert.validFrom.toISOString(),
      validTo: generatedCert.validTo.toISOString(),
      fingerprintSha256: generatedCert.fingerprintSha256,
      metadata: {
        storagePath: generatedCert.storagePath,
        password: password
      }
    });

    await createIdentityAuditLog({ userId: verification.user_id, verificationId: id, action: "IDENTITY_APPROVED", context, metadata: { reviewedBy: adminUserId } });
    await auditService.record({ userId: adminUserId, action: "IDENTITY_VERIFIED", entityType: "identity_verification", entityId: id, ...context });
    return mapIdentityVerification(verification);
  },

  async reject(adminUserId: string, id: string, reason: string, context: Context) {
    const verification = await rejectVerification(adminUserId, id, reason);
    if (!verification) throw new AppError(404, "IDENTITY_NOT_FOUND", "Verificacion no encontrada.");
    await createIdentityAuditLog({ userId: verification.user_id, verificationId: id, action: "IDENTITY_REJECTED", context, metadata: { reviewedBy: adminUserId, reason } });
    return mapIdentityVerification(verification);
  }
};
