import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(2)
});

export const sendDocumentSchema = z.object({
  signers: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    signingOrder: z.number().int().positive().optional()
  })).min(1),
  expiresInDays: z.number().int().positive().max(90).default(15)
});

