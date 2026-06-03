import multer from "multer";
import { authenticate } from "../../middlewares/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requestContext } from "../../utils/requestContext.js";
import { createDocumentSchema } from "./schema.js";
import { documentService } from "./service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export const documentController = {
  create: [authenticate, upload.single("file"), asyncHandler(async (req, res) => {
    const body = createDocumentSchema.parse(req.body);
    if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED", message: "Archivo PDF requerido." });
    res.status(201).json({ data: await documentService.create(req.user!.id, body, req.file, requestContext(req)) });
  })],
  list: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await documentService.list(req.user!.id) });
  })],
  get: [authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await documentService.get(req.user!.id, req.params.id) });
  })],
  remove: [authenticate, asyncHandler(async (req, res) => {
    res.json(await documentService.remove(req.user!.id, req.params.id));
  })]
};

