import { authenticate } from "../../middlewares/authenticate.js";
import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { updateProfileSchema } from "./schema.js";
import { userService } from "./service.js";

export const userController = {
  me: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await userService.me(req.user!.id) });
  })],
  updateMe: [authenticate, validateBody(updateProfileSchema), asyncHandler(async (req, res) => {
    res.json({ data: await userService.updateMe(req.user!.id, req.body) });
  })]
};

