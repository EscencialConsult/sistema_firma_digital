export type IdentityStatus = "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED";

export type IdentityDocumentType = "DOCUMENT_FRONT" | "DOCUMENT_BACK" | "SELFIE";

export type PersonalData = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  nationality: string;
  country: string;
  province: string;
  city: string;
  address?: string;
  phone: string;
  email: string;
  cuitCuil?: string;
};

export type IdentityDocument = {
  id: string;
  type: IdentityDocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  uploadedAt: string;
};

export type IdentityAuditLog = {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type IdentityVerification = {
  id: string;
  status: IdentityStatus;
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  birthDate?: string;
  nationality?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  cuitCuil?: string;
  declarationAccepted?: boolean;
  declarationText?: string;
  declarationVersion?: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  requestHash?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  expiresAt?: string;
  documents?: IdentityDocument[];
  auditLogs?: IdentityAuditLog[];
};
