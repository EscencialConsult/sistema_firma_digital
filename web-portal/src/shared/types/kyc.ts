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
  provider?: string;
  providerSessionId?: string;
  providerSessionUrl?: string;
  providerSessionToken?: string;
  personalData?: KycPersonalData | null;
  fullName?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  cuitCuil?: string | null;
  documents: KycDocument[];
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/** KYC Wizard step index */
export type KycStep = 0 | 1 | 2 | 3 | 4;

export const KYC_STEP_LABELS = [
  "Datos personales",
  "Verificacion de identidad",
] as const;
