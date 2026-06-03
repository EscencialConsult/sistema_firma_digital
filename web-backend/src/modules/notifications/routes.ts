import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { query } from "../../database/pool.js";

export const notificationRoutes = Router();

notificationRoutes.get("/", authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (_req, res) => {
  const result = await query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
  res.json({ data: result.rows });
}));

