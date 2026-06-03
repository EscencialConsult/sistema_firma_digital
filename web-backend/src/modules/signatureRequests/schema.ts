import { z } from "zod";

export const sendDocumentSchema = z.object({
  signers: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    signingOrder: z.coerce.number().int().positive().optional()
  })).min(1),
  expiresInDays: z.coerce.number().int().positive().max(90).default(15)
});

export const signRequestSchema = z.object({
  acceptedTerms: z.literal(true),
  signatureType: z.enum(["ELECTRONIC", "DIGITAL_CERTIFICATE", "REMOTE_PROVIDER"]).default("ELECTRONIC"),
  certificateId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const rejectRequestSchema = z.object({
  reason: z.string().min(2).optional()
});

export const signatureConformitySchema = z.object({
  acceptanceText: z.string().min(10)
});

