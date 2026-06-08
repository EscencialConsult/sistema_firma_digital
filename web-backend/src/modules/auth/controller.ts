import type { Response } from "express";
import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requestContext } from "../../utils/requestContext.js";
import { authService } from "./service.js";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./schema.js";

const refreshCookieName = "firma_refresh_token";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
}

function readCookie(header: string | undefined, name: string) {
  return header
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(refreshCookieName, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName, { path: "/api/auth" });
}

export const authController = {
  register: [validateBody(registerSchema), asyncHandler(async (req, res) => {
    const result = await authService.register(req.body, requestContext(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  })],
  login: [validateBody(loginSchema), asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  })],
  refresh: asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req.headers.cookie, refreshCookieName) ?? refreshSchema.parse(req.body).refreshToken;
    const result = await authService.refresh(refreshToken);
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  }),
  logout: asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req.headers.cookie, refreshCookieName) ?? logoutSchema.safeParse(req.body).data?.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  })
};
