import { z } from "zod";
import { IDENTITY_STATUSES } from "./identity.constants.js";

export const personalDataSchema = z.object({
  fullName: z.string().min(2),
  documentType: z.string().min(2),
  documentNumber: z.string().min(4),
  birthDate: z.string().min(8),
  nationality: z.string().min(2),
  country: z.string().min(2),
  province: z.string().min(2),
  city: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().min(6),
  email: z.string().email(),
  cuitCuil: z.string().optional()
});

export const submitIdentitySchema = z.object({
  declarationAccepted: z.literal(true),
  declarationText: z.string().min(40),
  declarationVersion: z.string().min(1)
});

export const rejectIdentitySchema = z.object({
  reason: z.string().min(5)
});

export const identityStatusQuerySchema = z.object({
  status: z.enum(IDENTITY_STATUSES as [string, ...string[]]).optional()
});
