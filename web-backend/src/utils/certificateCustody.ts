import { config } from "../config/env.js";
import { AppError } from "./AppError.js";
import { secureToken } from "./crypto.js";

export function assertSoftwareCertificateCustodyAllowed() {
  if (config.nodeEnv === "production") {
    throw new AppError(
      503,
      "CERTIFICATE_CUSTODY_REQUIRED",
      "La firma con certificados P12 generados por software esta bloqueada en produccion. Configure KMS, HSM o PKCS#11 antes de habilitar este flujo."
    );
  }
}

export function createDevelopmentP12Password() {
  return secureToken(32);
}
