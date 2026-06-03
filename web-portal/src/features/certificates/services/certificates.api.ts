import { apiClient } from "../../../shared/services/apiClient";

export type CertificateRecord = {
  id: string;
  label: string;
  type: string;
  issuer?: string;
  status: string;
  valid_to?: string;
  created_at: string;
};

export const certificatesApi = {
  async list() {
    const response = await apiClient.get<{ data: CertificateRecord[] }>("/certificates");
    return response.data;
  }
};
