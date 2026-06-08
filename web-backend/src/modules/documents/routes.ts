import { Router } from "express";
import { signatureRequestController } from "../signatureRequests/controller.js";
import { documentController } from "./controller.js";

export const documentRoutes = Router();

documentRoutes.post("/", documentController.create);
documentRoutes.get("/", documentController.list);
documentRoutes.get("/pkcs11/tokens", documentController.detectPkcs11Tokens);
documentRoutes.post("/:id/sign/pkcs11", documentController.signWithPkcs11);
documentRoutes.get("/:id", documentController.get);
documentRoutes.delete("/:id", documentController.remove);
documentRoutes.post("/:id/send", signatureRequestController.sendDocument);
documentRoutes.get("/:id/audit", signatureRequestController.documentAudit);
documentRoutes.get("/:id/download", signatureRequestController.downloadDocument);
