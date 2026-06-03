import { asyncHandler } from "../../utils/asyncHandler.js";
import { auditService } from "./service.js";

export const auditController = {
  listRecent: asyncHandler(async (_req, res) => {
    res.json({ data: await auditService.listRecent() });
  }),
  listMine: asyncHandler(async (req, res) => {
    res.json({ data: await auditService.listMine(req.user!.id) });
  })
};
