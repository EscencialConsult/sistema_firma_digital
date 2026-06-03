import { authenticate } from "../../middlewares/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { dashboardService } from "./service.js";

export const dashboardController = {
  summary: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await dashboardService.summary(req.user!) });
  })]
};
