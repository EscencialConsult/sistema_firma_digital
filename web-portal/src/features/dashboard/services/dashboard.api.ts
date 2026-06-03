import { apiClient } from "../../../shared/services/apiClient";

export type DashboardSummary = {
  stats: {
    documents: number;
    pendingSignatures: number;
    completedDocuments: number;
    rejectedDocuments: number;
  };
  recentDocuments: Array<Record<string, any>>;
  recentActivity: Array<Record<string, any>>;
};

export const dashboardApi = {
  async summary() {
    const response = await apiClient.get<{ data: DashboardSummary }>("/dashboard/summary");
    return response.data;
  }
};
