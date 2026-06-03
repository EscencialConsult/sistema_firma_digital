export type DocumentStatus = "DRAFT" | "SENT" | "VIEWED" | "SIGNED" | "PARTIALLY_SIGNED" | "REJECTED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
export type SignatureStatus = "PENDING" | "VIEWED" | "SIGNED" | "REJECTED" | "EXPIRED";
export type VerificationStatus = "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED";

export type DocumentSummary = {
  id: string;
  title: string;
  status: DocumentStatus;
  owner: string;
  updatedAt: string;
  hash: string;
  signers: number;
};

export type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  at: string;
  detail: string;
};

