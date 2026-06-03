import type { IdentityStatus } from "../identity.types.js";

export type IdentityVerificationEntity = {
  id: string;
  user_id: string;
  status: IdentityStatus;
  full_name: string | null;
  document_type: string | null;
  document_number: string | null;
  birth_date: string | null;
  nationality: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  cuit_cuil: string | null;
  declaration_accepted: boolean;
  declaration_text: string | null;
  declaration_version: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

