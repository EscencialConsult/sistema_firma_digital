export type SigningStep = "preview" | "conformity" | "otp" | "complete";

export interface SigningRequest {
  id: string;
  documentId: string;
  documentTitle: string;
  signerEmail: string;
  signerName: string;
  status: "PENDING" | "VIEWED" | "CONFORMITY_ACCEPTED" | "SIGNED" | "REJECTED";
  acceptedConformity: boolean;
  sha256Hash: string;
  fileName: string;
  pdfUrl: string | null;
  sentAt: string;
  expiresAt: string;
  /** Set when the document was created from a template in the admin panel */
  templateId?: string;
  templateFields?: Record<string, string>;
}

export interface OtpChallenge {
  /** Masked email shown to user, e.g. "j***@gmail.com" */
  maskedEmail: string;
  /** Expiration timestamp for the OTP */
  expiresAt: string;
}

export interface SignatureResult {
  signatureId: string;
  documentHash: string;
  signedAt: string;
  signerEmail: string;
  signerName: string;
  ipAddress: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  documentHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
