import multer from "multer";
import { config } from "../../config/env.js";
import { authenticate, authorize } from "../../middlewares/authenticate.js";
import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requestContext } from "../../utils/requestContext.js";
import { identityStatusQuerySchema, personalDataSchema, rejectIdentitySchema, submitIdentitySchema } from "./identity.schema.js";
import { identityService } from "./identity.service.js";
import type { IdentityDocumentType, IdentityStatus } from "./identity.types.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.identityMaxFileMb * 1024 * 1024 }
});

function uploadHandler(type: IdentityDocumentType) {
  return [
    authenticate,
    upload.single("file"),
    asyncHandler(async (req, res) => {
      if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED", message: "Archivo requerido." });
      res.status(201).json({ data: await identityService.uploadDocument(req.user!.id, type, req.file, requestContext(req)) });
    })
  ];
}

export const identityController = {
  me: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await identityService.me(req.user!.id) });
  })],
  start: [authenticate, asyncHandler(async (req, res) => {
    res.status(201).json({ data: await identityService.start(req.user!.id, requestContext(req)) });
  })],
  updatePersonalData: [authenticate, validateBody(personalDataSchema), asyncHandler(async (req, res) => {
    res.json({ data: await identityService.updatePersonalData(req.user!.id, req.body, requestContext(req)) });
  })],
  uploadFront: uploadHandler("DOCUMENT_FRONT"),
  uploadBack: uploadHandler("DOCUMENT_BACK"),
  uploadSelfie: uploadHandler("SELFIE"),
  submit: [authenticate, validateBody(submitIdentitySchema), asyncHandler(async (req, res) => {
    res.json({ data: await identityService.submit(req.user!.id, req.body, requestContext(req)) });
  })],
  status: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await identityService.status(req.user!.id) });
  })],
  adminList: [authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
    const query = identityStatusQuerySchema.parse(req.query);
    res.json({ data: await identityService.listAdmin(req.user!, query.status as IdentityStatus | undefined) });
  })],
  adminGet: [authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
    res.json({ data: await identityService.getAdmin(req.user!, req.params.id) });
  })],
  adminApprove: [authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), asyncHandler(async (req, res) => {
    res.json({ data: await identityService.approve(req.user!, req.params.id, requestContext(req)) });
  })],
  adminReject: [authenticate, authorize("ADMIN", "ORGANIZATION_ADMIN"), validateBody(rejectIdentitySchema), asyncHandler(async (req, res) => {
    res.json({ data: await identityService.reject(req.user!, req.params.id, req.body.reason, requestContext(req)) });
  })]
};
