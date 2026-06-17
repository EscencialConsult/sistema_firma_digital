export type KycStatus = "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED";

export type KycDocumentType = "DOCUMENT_FRONT" | "DOCUMENT_BACK" | "SELFIE";

export interface KycPersonalData {
  fullName: string;
  documentType: string;
  documentNumber: string;
  cuilCuit: string;
  birthDate: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  country: string;
}

export interface KycDocument {
  id: string;
  type: KycDocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  /** Preview URL for the uploaded image (blob URL or remote URL) */
  previewUrl?: string;
}

export interface KycVerification {
  id: string;
  userId: string;
  status: KycStatus;
  personalData: KycPersonalData | null;
  documents: KycDocument[];
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/** KYC Wizard step index */
export type KycStep = 0 | 1 | 2 | 3;

export const KYC_STEP_LABELS = [
  "Datos personales",
  "Frente del DNI",
  "Dorso del DNI",
  "Selfie",
] as const;
