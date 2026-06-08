import type { AuthUser } from "../../middlewares/authenticate.js";

export function scopedWhere(user: AuthUser, alias: string, params: unknown[]) {
  if (user.role === "ADMIN") return "";
  if (!user.organizationId) {
    params.push("__no_organization__");
    return ` AND ${alias}.organization_id::text = $${params.length}`;
  }
  params.push(user.organizationId);
  return ` AND ${alias}.organization_id = $${params.length}`;
}

export function scopedUserWhere(user: AuthUser, alias: string, params: unknown[]) {
  return scopedWhere(user, alias, params);
}

export function scopedDocumentWhere(user: AuthUser, userAlias: string, params: unknown[]) {
  return scopedWhere(user, userAlias, params);
}
