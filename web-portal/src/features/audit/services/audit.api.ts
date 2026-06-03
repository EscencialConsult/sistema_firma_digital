import { apiClient } from "../../../shared/services/apiClient";

export type AuditRecord = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
};

export const auditApi = {
  async mine() {
    const response = await apiClient.get<{ data: AuditRecord[] }>("/audit/me");
    return response.data;
  }
};
