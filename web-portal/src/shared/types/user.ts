export type UserRole = "USER" | "ADMIN" | "ORG_ADMIN" | "SUPER_ADMIN" | "ORGANIZATION_ADMIN";

export type VerificationStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED";

export type CertificateStatus = "NONE" | "ACTIVE" | "REVOKED" | "EXPIRED";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  certificateStatus: CertificateStatus;
  organizationId?: string;
  termsAcceptedAt?: string;
  phone?: string;
  address?: string;
  documentNumber?: string;
  cuilCuit?: string;
  birthDate?: string;
  /** IDs de todas las orgs donde tiene membresía activa (incluyendo la primaria) */
  memberOrgIds?: string[];
  /** true si pertenece a más de una organización */
  isMultiOrg?: boolean;
}

export interface UserProfile extends AuthUser {
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  certificateStatus: CertificateStatus;
  createdAt: string;
  documentNumber: string | null;
  cuilCuit:       string | null;
  address:        string | null;
}
