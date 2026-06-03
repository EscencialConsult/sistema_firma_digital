import { z } from "zod";
import { personalDataSchema } from "../identity.schema.js";

export type UpdatePersonalDataDto = z.infer<typeof personalDataSchema>;

