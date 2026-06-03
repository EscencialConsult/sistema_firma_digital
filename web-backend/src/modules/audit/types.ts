export type AuditAction =
  | "USER_REGISTERED"
  | "IDENTITY_VERIFICATION_STARTED"
  | "IDENTITY_VERIFIED"
  | "CERTIFICATE_CREATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_SENT"
  | "DOCUMENT_VIEWED"
  | "DOCUMENT_SIGNED"
  | "DOCUMENT_ACCEPTED"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_COMPLETED"
  | "DOCUMENT_DOWNLOADED";

export type AuditLogInput = {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  documentHash?: string | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

