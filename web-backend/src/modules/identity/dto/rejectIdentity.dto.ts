import { z } from "zod";
import { rejectIdentitySchema } from "../identity.schema.js";

export type RejectIdentityDto = z.infer<typeof rejectIdentitySchema>;

