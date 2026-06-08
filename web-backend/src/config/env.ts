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
  ADMIN_PASSWORD: z.string().min(8).default("Admin123456"),
  PKCS11_MODULE_PATH: z.string().optional(),
  PKCS11_TOOL_PATH: z.string().default("pkcs11-tool"),
  PKCS11_CERT_ID: z.string().optional(),
  PYHANKO_PYTHON_PATH: z.string().optional()
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

function assertProductionSecretsAreSafe() {
  if (env.NODE_ENV !== "production") return;

  const unsafeFields: string[] = [];
  const weakJwtSecrets = [
    ["JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET],
    ["JWT_REFRESH_SECRET", env.JWT_REFRESH_SECRET]
  ] as const;

  for (const [name, value] of weakJwtSecrets) {
    if (value.length < 32 || value.toLowerCase().includes("change_me")) {
      unsafeFields.push(name);
    }
  }

  if (env.ADMIN_PASSWORD === "Admin123456") {
    unsafeFields.push("ADMIN_PASSWORD");
  }

  try {
    const databaseUrl = new URL(env.DATABASE_URL);
    if (!databaseUrl.password || databaseUrl.password === "firma" || databaseUrl.password.toLowerCase().includes("change_me")) {
      unsafeFields.push("DATABASE_URL");
    }
  } catch {
    unsafeFields.push("DATABASE_URL");
  }

  if (unsafeFields.length) {
    throw new Error(
      `Unsafe production environment variables: ${unsafeFields.join(", ")}. ` +
        "Replace all default credentials and secrets before starting in production."
    );
  }
}

assertProductionSecretsAreSafe();

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
  adminPassword: env.ADMIN_PASSWORD,
  pkcs11ModulePath: env.PKCS11_MODULE_PATH,
  pkcs11ToolPath: env.PKCS11_TOOL_PATH,
  pkcs11CertId: env.PKCS11_CERT_ID,
  pyhankoPythonPath: env.PYHANKO_PYTHON_PATH
};
