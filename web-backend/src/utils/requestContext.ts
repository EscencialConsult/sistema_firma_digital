import type { Request } from "express";

export function requestContext(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] ?? ""
  };
}

