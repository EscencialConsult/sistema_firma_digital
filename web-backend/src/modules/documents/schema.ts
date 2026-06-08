import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(2)
});

export const pkcs11SignDocumentSchema = z.object({
  pin: z.string().optional(),
  certId: z.string().optional(),
  modulePath: z.string().optional(),
  slot: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const pkcs11DetectSchema = z.object({
  pin: z.string().optional()
});

export const sendDocumentSchema = z.object({
  signers: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    signingOrder: z.number().int().positive().optional()
  })).min(1),
  expiresInDays: z.number().int().positive().max(90).default(15)
});
