export type IdentityStatus = "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED";

export type IdentityDocumentType = "DOCUMENT_FRONT" | "DOCUMENT_BACK" | "SELFIE";

export type IdentityAuditAction =
  | "IDENTITY_STARTED"
  | "IDENTITY_PERSONAL_DATA_UPDATED"
  | "IDENTITY_DOCUMENT_FRONT_UPLOADED"
  | "IDENTITY_DOCUMENT_BACK_UPLOADED"
  | "IDENTITY_SELFIE_UPLOADED"
  | "IDENTITY_DECLARATION_ACCEPTED"
  | "IDENTITY_SUBMITTED"
  | "IDENTITY_APPROVED"
  | "IDENTITY_REJECTED"
  | "IDENTITY_EXPIRED";

export type IdentityProvider = {
  startVerification(userId: string): Promise<ProviderSession>;
  verifyDocument(data: IdentityDocumentData): Promise<ProviderVerificationResult>;
  verifySelfie(data: SelfieData): Promise<ProviderVerificationResult>;
  getStatus(providerVerificationId: string): Promise<ProviderStatus>;
};

export type ProviderSession = {
  providerVerificationId: string;
  redirectUrl?: string;
};

export type IdentityDocumentData = {
  verificationId: string;
  type: Extract<IdentityDocumentType, "DOCUMENT_FRONT" | "DOCUMENT_BACK">;
  filePath: string;
  checksumSha256: string;
};

export type SelfieData = {
  verificationId: string;
  filePath: string;
  checksumSha256: string;
};

export type ProviderVerificationResult = {
  status: "PASSED" | "FAILED" | "IN_REVIEW";
  score?: number;
  metadata?: Record<string, unknown>;
};

export type ProviderStatus = {
  status: IdentityStatus;
  metadata?: Record<string, unknown>;
};

