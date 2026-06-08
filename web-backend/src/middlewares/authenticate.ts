import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";

export type AuthUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "ORGANIZATION_ADMIN";
  organizationId?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Token requerido.");
  req.user = verifyAccessToken(token);
  next();
};

export function authorize(...roles: AuthUser["role"][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Token requerido.");
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "FORBIDDEN", "No tenes permisos para esta accion.");
    }
    next();
  };
}
