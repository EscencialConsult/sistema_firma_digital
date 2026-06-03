import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import type { AuthUser } from "../middlewares/authenticate.js";
import { AppError } from "./AppError.js";

export function signAccessToken(user: AuthUser) {
  const options: jwt.SignOptions = { expiresIn: config.jwtAccessExpiresIn as jwt.SignOptions["expiresIn"] };
  return jwt.sign(user, config.jwtAccessSecret, options);
}

export function signRefreshToken(payload: { userId: string; tokenId: string }) {
  const options: jwt.SignOptions = { expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, config.jwtRefreshSecret, options);
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    return jwt.verify(token, config.jwtAccessSecret) as AuthUser;
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Token invalido o vencido.");
  }
}

export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, config.jwtRefreshSecret) as { userId: string; tokenId: string };
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalido o vencido.");
  }
}
