import { Router } from "express";
import { identityController } from "./identity.controller.js";

export const identityRoutes = Router();

identityRoutes.get("/me", identityController.me);
identityRoutes.post("/start", identityController.start);
identityRoutes.patch("/personal-data", identityController.updatePersonalData);
identityRoutes.post("/upload-document-front", identityController.uploadFront);
identityRoutes.post("/upload-document-back", identityController.uploadBack);
identityRoutes.post("/upload-selfie", identityController.uploadSelfie);
identityRoutes.post("/submit", identityController.submit);
identityRoutes.get("/status", identityController.status);
