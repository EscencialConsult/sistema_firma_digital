import { apiClient } from "../../../shared/services/apiClient";

export type SignatureRequestRecord = {
  id: string;
  document_id: string;
  document_title: string;
  signer_email: string;
  signer_name?: string;
  status: string;
  sent_at: string;
  expires_at: string;
};

export const signatureRequestsApi = {
  async listMine() {
    const response = await apiClient.get<{ data: SignatureRequestRecord[] }>("/signature-requests");
    return response.data;
  }
};
