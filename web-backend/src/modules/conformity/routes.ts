import { Router } from "express";
import { conformityController } from "./controller.js";

export const conformityRoutes = Router();

conformityRoutes.get("/", conformityController.list);
conformityRoutes.post("/:id", conformityController.accept);

