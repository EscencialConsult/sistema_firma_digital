import type { Express } from "express";
import { adminRoutes } from "./modules/admin/routes.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { certificateRoutes } from "./modules/certificates/routes.js";
import { conformityRoutes } from "./modules/conformity/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { documentRoutes } from "./modules/documents/routes.js";
import { identityRoutes } from "./modules/identity/identity.routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { signatureRequestRoutes } from "./modules/signatureRequests/routes.js";
import { userRoutes } from "./modules/users/routes.js";

export function registerRoutes(app: Express) {
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/identity", identityRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/conformity", conformityRoutes);
  app.use("/api/signature-requests", signatureRequestRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/admin", adminRoutes);
}
