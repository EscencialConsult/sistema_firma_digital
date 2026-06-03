import type { IdentityDocumentType } from "../identity.types.js";

export type IdentityDocumentEntity = {
  id: string;
  identity_verification_id: string;
  type: IdentityDocumentType;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  checksum_sha256: string;
  uploaded_at: string;
  created_at: string;
};

