import type { AuthUser } from "../../middlewares/authenticate.js";
import { getDashboardSummary } from "./repository.js";

export const dashboardService = {
  summary(user: AuthUser) {
    return getDashboardSummary(user);
  }
};
