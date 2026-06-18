import { Router } from "express";
import { detectPkcs11TokensHandler, signWithPkcs11Handler } from "./pkcs11Router.js";
import { detectWindowsCertsHandler, signWithWindowsCertHandler } from "./windowsCertRouter.js";

export const agentRouter = Router();

agentRouter.get("/pkcs11/tokens", detectPkcs11TokensHandler);
agentRouter.post("/pkcs11/sign", signWithPkcs11Handler);

agentRouter.get("/windows/certs", detectWindowsCertsHandler);
agentRouter.post("/windows/sign", signWithWindowsCertHandler);
