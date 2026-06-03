import { Router } from "express";
import { dashboardController } from "./controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/summary", dashboardController.summary);
