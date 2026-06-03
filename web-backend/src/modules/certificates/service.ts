import { AppError } from "../../utils/AppError.js";
import { auditService } from "../audit/service.js";
import { createCertificate, getCertificate, listCertificates, updateCertificateStatus } from "./repository.js";

export const certificateService = {
  async create(userId: string, input: Record<string, any>) {
    const certificate = await createCertificate(userId, input);
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
  }
};

