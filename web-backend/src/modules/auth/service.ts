import { AppError } from "../../utils/AppError.js";
import { hashPassword, secureToken, verifyPassword } from "../../utils/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { auditService } from "../audit/service.js";
import { createRefreshToken, createUser, findRefreshToken, findUserByEmail, findUserById, revokeRefreshToken } from "./repository.js";

function publicUser(user: Awaited<ReturnType<typeof findUserByEmail>>) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    organizationId: user.organization_id,
    verificationStatus: user.verification_status,
    certificateStatus: user.certificate_status
  };
}

async function issueTokens(user: NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>) {
  const refreshSecret = secureToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const refreshRow = await createRefreshToken(user.id, refreshSecret, expiresAt);
  return {
    accessToken: signAccessToken({ id: user.id, email: user.email, role: user.role, organizationId: user.organization_id }),
    refreshToken: signRefreshToken({ userId: user.id, tokenId: refreshRow.id }) + "." + refreshSecret
  };
}

export const authService = {
  async register(input: { email: string; password: string; fullName: string; organizationName?: string }, context: { ipAddress?: string; userAgent?: string }) {
    const existing = await findUserByEmail(input.email);
    if (existing) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "El email ya esta registrado.");
    const user = await createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      organizationName: input.organizationName
    });
    await auditService.record({
      userId: user.id,
      action: "USER_REGISTERED",
      entityType: "user",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    return { user: publicUser(user), ...(await issueTokens(user)) };
  },

  async login(input: { email: string; password: string }) {
    const user = await findUserByEmail(input.email);
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email o contrasena incorrectos.");
    }
    return { user: publicUser(user), ...(await issueTokens(user)) };
  },

  async refresh(refreshToken: string) {
    const [jwtToken, secret] = refreshToken.split(".");
    if (!jwtToken || !secret) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalido.");
    const payload = verifyRefreshToken(jwtToken);
    const stored = await findRefreshToken(payload.tokenId, secret);
    if (!stored) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalido.");
    const user = await findUserById(payload.userId);
    if (!user) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Usuario no encontrado.");
    await revokeRefreshToken(payload.tokenId);
    return { user: publicUser(user), ...(await issueTokens(user)) };
  },

  async logout(refreshToken: string) {
    const [jwtToken] = refreshToken.split(".");
    if (jwtToken) {
      const payload = verifyRefreshToken(jwtToken);
      await revokeRefreshToken(payload.tokenId);
    }
    return { ok: true };
  },

  publicUser,
  findUserById
};
