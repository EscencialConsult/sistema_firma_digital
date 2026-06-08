import { Router } from "express";
import { certificateController } from "./controller.js";

export const certificateRoutes = Router();

certificateRoutes.post("/", certificateController.create);
certificateRoutes.get("/", certificateController.list);
certificateRoutes.get("/:id/download", certificateController.download);
certificateRoutes.get("/:id", certificateController.get);
certificateRoutes.patch("/:id/status", certificateController.updateStatus);
