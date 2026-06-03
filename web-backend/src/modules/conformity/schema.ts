import { z } from "zod";

export const conformitySchema = z.object({
  email: z.string().email(),
  acceptanceText: z.string().min(20).default("Declaro haber leido y aceptado el contenido del documento, prestando conformidad de manera libre, voluntaria e informada.")
});

