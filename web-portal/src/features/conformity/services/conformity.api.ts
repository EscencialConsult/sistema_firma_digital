import { apiClient } from "../../../shared/services/apiClient";

export type ConformityRecord = {
  id: string;
  document_id: string;
  document_title: string;
  acceptance_text: string;
  document_hash: string;
  document_version: number;
  ip_address?: string;
  created_at: string;
};

export const conformityApi = {
  async listMine() {
    const response = await apiClient.get<{ data: ConformityRecord[] }>("/conformity");
    return response.data;
  }
};
