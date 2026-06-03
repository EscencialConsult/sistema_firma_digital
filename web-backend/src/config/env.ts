import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"),
  UPLOADS_DIR: z.string().default(process.env.UPLOAD_DIR ?? "uploads"),
  MAX_FILE_SIZE_MB: z.coerce.number().default(Number(process.env.IDENTITY_MAX_FILE_MB ?? 10)),
  IDENTITY_UPLOAD_DIR: z.string().default("uploads/identity"),
  IDENTITY_EXPIRES_DAYS: z.coerce.number().default(365),
  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("Admin123456")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const missing = parsedEnv.error.issues
    .map((issue) => issue.path.join("."))
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `Missing or invalid environment variables: ${missing}. ` +
      "Create web-backend/.env from .env.example before running the backend."
  );
}

const env = parsedEnv.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  corsOrigin: env.CORS_ORIGIN.split(",").map((item) => item.trim()),
  uploadDir: env.UPLOADS_DIR,
  identityUploadDir: env.IDENTITY_UPLOAD_DIR,
  identityMaxFileMb: env.MAX_FILE_SIZE_MB,
  identityExpiresDays: env.IDENTITY_EXPIRES_DAYS,
  appUrl: env.APP_URL,
  apiUrl: env.API_URL,
  adminEmail: env.ADMIN_EMAIL,
  adminPassword: env.ADMIN_PASSWORD
};
