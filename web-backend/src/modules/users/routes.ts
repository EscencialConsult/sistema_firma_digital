import { Router } from "express";
import { userController } from "./controller.js";

export const userRoutes = Router();

userRoutes.get("/me", userController.me);
userRoutes.patch("/me", userController.updateMe);

