import { authenticate } from "../../middlewares/authenticate.js";
import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createCertificateSchema, certificateStatusSchema } from "./schema.js";
import { certificateService } from "./service.js";

export const certificateController = {
  create: [authenticate, validateBody(createCertificateSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await certificateService.create(req.user!.id, req.body) });
  })],
  list: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await certificateService.list(req.user!.id) });
  })],
  get: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await certificateService.get(req.user!.id, req.params.id) });
  })],
  updateStatus: [authenticate, validateBody(certificateStatusSchema), asyncHandler(async (req, res) => {
    res.json({ data: await certificateService.updateStatus(req.user!.id, req.params.id, req.body.status) });
  })]
};

