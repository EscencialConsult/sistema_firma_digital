export type UserRole = "USER" | "ADMIN" | "ORGANIZATION_ADMIN";

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
}

export interface UserProfile extends AuthUser {
  phone?: string;
  address?: string;
  documentNumber?: string;
  cuilCuit?: string;
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
}
