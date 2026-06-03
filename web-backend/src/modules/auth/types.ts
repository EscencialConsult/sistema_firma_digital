export type UserRole = "USER" | "ADMIN" | "ORGANIZATION_ADMIN";

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  verification_status: string;
  certificate_status: string;
};

