import { authenticate } from "../../middlewares/authenticate.js";
import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requestContext } from "../../utils/requestContext.js";
import { sendDocumentSchema, signRequestSchema, rejectRequestSchema, signatureConformitySchema } from "./schema.js";
import { signatureRequestService } from "./service.js";

export const signatureRequestController = {
  listMine: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.listForUser(req.user!.email) });
  })],
  sendDocument: [authenticate, validateBody(sendDocumentSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await signatureRequestService.sendDocument(req.user!.id, req.params.id, req.body, requestContext(req)) });
  })],
  getById: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.getById(req.params.id, req.user!.email) });
  })],
  signById: [authenticate, validateBody(signRequestSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await signatureRequestService.signById(req.params.id, req.user!.email, req.body, requestContext(req)) });
  })],
  conformityById: [authenticate, validateBody(signatureConformitySchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await signatureRequestService.conformityById(req.params.id, req.user!.email, req.body, requestContext(req)) });
  })],
  getByToken: asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.getByToken(req.params.token) });
  }),
  view: asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.view(req.params.token, requestContext(req)) });
  }),
  sign: [validateBody(signRequestSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await signatureRequestService.sign(req.params.token, req.body, requestContext(req)) });
  })],
  acceptConformity: [validateBody(signatureConformitySchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await signatureRequestService.acceptConformity(req.params.token, req.body, requestContext(req)) });
  })],
  reject: [validateBody(rejectRequestSchema), asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.reject(req.params.token, req.body.reason, requestContext(req)) });
  })],
  rejectById: [authenticate, validateBody(rejectRequestSchema), asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.rejectById(req.params.id, req.user!.email, req.body.reason, requestContext(req)) });
  })],
  downloadByToken: asyncHandler(async (req, res) => {
    const file = await signatureRequestService.publicDownload(req.params.token);
    res.download(file.storage_path, file.file_name);
  }),
  downloadDocument: [authenticate, asyncHandler(async (req, res) => {
    const file = await signatureRequestService.downloadDocument(req.user!, req.params.id);
    res.download(file.storage_path, file.file_name);
  })],
  documentAudit: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await signatureRequestService.documentAudit(req.params.id) });
  })]
};
