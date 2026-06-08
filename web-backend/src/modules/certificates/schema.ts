import { z } from "zod";

export const createCertificateSchema = z.object({
  label: z.string().min(2),
  type: z.enum(["P12", "PFX", "CA_ISSUED", "REMOTE", "USB_TOKEN", "HSM"]).default("P12"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres.").optional(),
  issuer: z.string().optional(),
  subject: z.string().optional(),
  serialNumber: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  fingerprintSha256: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const certificateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED", "REVOKED"])
});
