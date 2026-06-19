export type ContractStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "CONFORMITY_ACCEPTED"
  | "SIGNED"
  | "REJECTED"
  | "COMPLETED"
  | "EXPIRED";

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
  templateId:     string | null;
  templateFields: Record<string, string> | null;
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
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  /** Variables that will be injected: e.g. {{alumno_nombre}}, {{monto}} */
  variables: string[];
  createdAt: string;
}
