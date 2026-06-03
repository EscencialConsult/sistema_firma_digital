import { Router } from "express";
import { signatureRequestController } from "./controller.js";

export const signatureRequestRoutes = Router();

signatureRequestRoutes.get("/", signatureRequestController.listMine);
signatureRequestRoutes.get("/id/:id", signatureRequestController.getById);
signatureRequestRoutes.post("/id/:id/sign", signatureRequestController.signById);
signatureRequestRoutes.post("/id/:id/conformity", signatureRequestController.conformityById);
signatureRequestRoutes.post("/id/:id/reject", signatureRequestController.rejectById);

signatureRequestRoutes.get("/:token", signatureRequestController.getByToken);
signatureRequestRoutes.post("/:token/view", signatureRequestController.view);
signatureRequestRoutes.post("/:token/sign", signatureRequestController.sign);
signatureRequestRoutes.post("/:token/conformity", signatureRequestController.acceptConformity);
signatureRequestRoutes.post("/:token/reject", signatureRequestController.reject);
signatureRequestRoutes.get("/:token/download", signatureRequestController.downloadByToken);
