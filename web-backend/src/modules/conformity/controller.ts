import { authenticate } from "../../middlewares/authenticate.js";
import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requestContext } from "../../utils/requestContext.js";
import { conformitySchema } from "./schema.js";
import { conformityService } from "./service.js";

export const conformityController = {
  list: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await conformityService.listForUser(req.user!.email) });
  })],
  accept: [authenticate, validateBody(conformitySchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await conformityService.accept(req.user!.id, req.params.id, req.body, requestContext(req)) });
  })]
};

