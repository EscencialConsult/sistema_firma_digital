export type ContractStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "CONFORMITY_ACCEPTED"
  | "SIGNED"
  | "REJECTED"
  | "COMPLETED"
  | "EXPIRED";

export interface SignaturePosition {
  /** "last" for last page, or a 0-based page index */
  page: "last" | number;
  /** X coordinate in mm from left edge */
  x: number;
  /** Y coordinate in mm from bottom edge */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
}

export const DEFAULT_SIGNATURE_POSITION: SignaturePosition = {
  page: "last", x: 50, y: 50, width: 80, height: 30,
};

export interface Contract {
  id: string;
  title: string;
  description: string;
  status: ContractStatus;
  ownerEmail: string;
  /** SHA-256 hash of the current PDF version */
  sha256Hash: string;
  /** Number of the current document version */
  versionNumber: number;
  fileName: string;
  /** Total number of signers assigned */
  totalSigners: number;
  /** Number of signers who have completed */
  completedSigners: number;
  /** URL del PDF consolidado con todas las firmas (disponible cuando status=COMPLETED) */
  finalPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  templateId: string | null;
  templateFields: Record<string, string> | null;
  contractTypeId: string | null;
  paymentTemplateId: string | null;
  signaturePosition: SignaturePosition;
}

export interface ContractDetail extends Contract {
  signers: ContractSigner[];
  /** URL to preview/download the PDF (will come from Supabase Storage) */
  pdfUrl: string | null;
}

export interface ContractSigner {
  id: string;
  email: string;
  name: string;
  status: "PENDING" | "VIEWED" | "CONFORMITY_ACCEPTED" | "SIGNED" | "REJECTED";
  sentAt: string;
  viewedAt: string | null;
  signedAt: string | null;
  signatureUrl: string | null;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  /** Variables that will be injected: e.g. {{alumno_nombre}}, {{monto}} */
  variables: string[];
  createdAt: string;
}
