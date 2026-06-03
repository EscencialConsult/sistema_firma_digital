import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export function sha256(value: Buffer | string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function secureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

