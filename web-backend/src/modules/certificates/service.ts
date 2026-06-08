import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { assertSoftwareCertificateCustodyAllowed } from "../../utils/certificateCustody.js";
import { generateP12Certificate } from "../../utils/certGenerator.js";
import { auditService } from "../audit/service.js";
import { createCertificate, getCertificate, getCertificateOwner, listCertificates, updateCertificateStatus } from "./repository.js";

export const certificateService = {
  async create(userId: string, input: Record<string, any>) {
    let certificateInput = { ...input };

    if (input.type === "P12" || input.type === "PFX") {
      assertSoftwareCertificateCustodyAllowed();
      if (!input.password) {
        throw new AppError(400, "CERTIFICATE_PASSWORD_REQUIRED", "Indica una contrasena para proteger el certificado P12.");
      }

      const owner = await getCertificateOwner(userId);
      if (!owner) throw new AppError(404, "USER_NOT_FOUND", "Usuario no encontrado.");

      const certFolder = path.resolve(config.uploadDir, "certificates");
      const generatedCert = await generateP12Certificate(
        userId,
        owner.full_name || "Usuario Verificado",
        owner.email,
        certFolder,
        input.password
      );

      certificateInput = {
        label: input.label,
        type: input.type,
        issuer: "Escencial CA",
        subject: `CN=${owner.full_name}, O=Escencial, E=${owner.email}`,
        serialNumber: generatedCert.serialNumber,
        validFrom: generatedCert.validFrom,
        validTo: generatedCert.validTo,
        fingerprintSha256: generatedCert.fingerprintSha256,
        metadata: {
          ...(typeof input.metadata === "object" && input.metadata ? input.metadata : {}),
          storagePath: generatedCert.storagePath,
          password: input.password,
          generatedBy: "escencial-self-signed"
        }
      };
    }

    const certificate = await createCertificate(userId, certificateInput);
    await auditService.record({ userId, action: "CERTIFICATE_CREATED", entityType: "certificate", entityId: certificate.id });
    return certificate;
  },
  list: listCertificates,
  async get(userId: string, id: string) {
    const cert = await getCertificate(userId, id);
    if (!cert) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificado no encontrado.");
    return cert;
  },
  async updateStatus(userId: string, id: string, status: string) {
    const cert = await updateCertificateStatus(userId, id, status);
    if (!cert) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificado no encontrado.");
    return cert;
  },
  async download(userId: string, id: string) {
    const cert = await this.get(userId, id);
    const storagePath = cert.metadata?.storagePath;
    if (!storagePath || typeof storagePath !== "string") {
      throw new AppError(404, "CERTIFICATE_FILE_NOT_FOUND", "Este certificado no tiene un archivo P12 disponible.");
    }

    await fs.access(storagePath).catch(() => {
      throw new AppError(404, "CERTIFICATE_FILE_NOT_FOUND", "Archivo de certificado no encontrado en el servidor.");
    });

    const fileName = `${cert.label.replace(/[^\w.\- ]+/g, "_")}.p12`;
    return { storagePath, fileName };
  }
};
