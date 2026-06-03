import type { IdentityAuditAction } from "../identity.types.js";

export type IdentityAuditLogEntity = {
  id: string;
  identity_verification_id: string;
  user_id: string | null;
  action: IdentityAuditAction;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
