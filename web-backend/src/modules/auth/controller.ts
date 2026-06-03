import { validateBody } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requestContext } from "../../utils/requestContext.js";
import { authService } from "./service.js";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./schema.js";

export const authController = {
  register: [validateBody(registerSchema), asyncHandler(async (req, res) => {
    res.status(201).json(await authService.register(req.body, requestContext(req)));
  })],
  login: [validateBody(loginSchema), asyncHandler(async (req, res) => {
    res.json(await authService.login(req.body));
  })],
  refresh: [validateBody(refreshSchema), asyncHandler(async (req, res) => {
    res.json(await authService.refresh(req.body.refreshToken));
  })],
  logout: [validateBody(logoutSchema), asyncHandler(async (req, res) => {
    res.json(await authService.logout(req.body.refreshToken));
  })]
};

