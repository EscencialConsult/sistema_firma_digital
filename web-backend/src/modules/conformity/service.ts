import { AppError } from "../../utils/AppError.js";
import { auditService } from "../audit/service.js";
import { getDocument } from "../documents/repository.js";
import { createConformity, listConformityAcceptances } from "./repository.js";

export const conformityService = {
  async listForUser(email: string) {
    return listConformityAcceptances(email);
  },
  async accept(userId: string, documentId: string, input: { email: string; acceptanceText: string }, context: { ipAddress?: string; userAgent?: string }) {
    const document = await getDocument(userId, documentId);
    if (!document?.current_version) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");
    const acceptance = await createConformity({
      documentId,
      userId,
      email: input.email,
      acceptanceText: input.acceptanceText,
      documentHash: document.current_version.sha256_hash,
      documentVersion: document.current_version.version_number,
      ...context
    });
    await auditService.record({ userId, action: "DOCUMENT_ACCEPTED", entityType: "document", entityId: documentId, documentHash: document.current_version.sha256_hash, ...context, metadata: { email: input.email } });
    return acceptance;
  }
};

