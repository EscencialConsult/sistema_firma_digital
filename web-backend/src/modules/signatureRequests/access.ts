import { AppError } from "../../utils/AppError.js";

type AuditAccessUser = {
  id: string;
  email: string;
  role: string;
};

type AuditAccessDocument = {
  owner_id: string;
};

export function canReadDocumentAudit(user: AuditAccessUser, document: AuditAccessDocument, isSigner: boolean) {
  return document.owner_id === user.id
    || user.role === "ADMIN"
    || user.role === "ORGANIZATION_ADMIN"
    || isSigner;
}

export function assertCanReadDocumentAudit(user: AuditAccessUser, document: AuditAccessDocument, isSigner: boolean) {
  if (!canReadDocumentAudit(user, document, isSigner)) {
    throw new AppError(403, "FORBIDDEN", "No tenes permisos para ver la auditoria de este documento.");
  }
}
