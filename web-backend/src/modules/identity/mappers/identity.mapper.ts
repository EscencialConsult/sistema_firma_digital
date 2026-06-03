import type { IdentityAuditLogEntity } from "../entities/identityAuditLog.entity.js";
import type { IdentityDocumentEntity } from "../entities/identityDocument.entity.js";

type RawVerification = Record<string, any> & {
  documents?: IdentityDocumentEntity[];
  auditLogs?: IdentityAuditLogEntity[];
};

function mapDocument(document: IdentityDocumentEntity) {
  return {
    id: document.id,
    type: document.type,
    fileName: document.file_name,
    mimeType: document.mime_type,
    fileSize: Number(document.file_size),
    checksumSha256: document.checksum_sha256,
    uploadedAt: document.uploaded_at
  };
}

function mapAuditLog(log: IdentityAuditLogEntity) {
  return {
    id: log.id,
    action: log.action,
    ip: log.ip,
    userAgent: log.user_agent,
    metadata: log.metadata,
    createdAt: log.created_at
  };
}

export function mapIdentityVerification(verification: RawVerification | null) {
  if (!verification) return null;
  return {
    id: verification.id,
    userId: verification.user_id,
    status: verification.status,
    fullName: verification.full_name || verification.user_full_name,
    documentType: verification.document_type,
    documentNumber: verification.document_number,
    birthDate: verification.birth_date,
    nationality: verification.nationality,
    country: verification.country,
    province: verification.province,
    city: verification.city,
    address: verification.address,
    phone: verification.phone,
    email: verification.email || verification.user_email,
    cuitCuil: verification.cuit_cuil,
    declarationAccepted: verification.declaration_accepted,
    declarationVersion: verification.declaration_version,
    submittedAt: verification.submitted_at,
    reviewedAt: verification.reviewed_at,
    reviewedBy: verification.reviewed_by,
    rejectionReason: verification.rejection_reason,
    expiresAt: verification.expires_at,
    createdAt: verification.created_at,
    updatedAt: verification.updated_at,
    documents: (verification.documents ?? []).map(mapDocument),
    auditLogs: (verification.auditLogs ?? []).map(mapAuditLog)
  };
}
