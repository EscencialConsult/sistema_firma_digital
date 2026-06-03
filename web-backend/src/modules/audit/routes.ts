import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/authenticate.js";
import { auditController } from "./controller.js";

export const auditRoutes = Router();

auditRoutes.get("/", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), auditController.listRecent);
auditRoutes.get("/me", authenticate, auditController.listMine);
