import { apiClient } from "../../../shared/services/apiClient";

export type DocumentRecord = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  created_at: string;
  sha256_hash?: string;
  file_name?: string;
  signers?: number;
};

export const documentsApi = {
  async list() {
    const response = await apiClient.get<{ data: DocumentRecord[] }>("/documents");
    return response.data;
  },
  async get(id: string) {
    const response = await apiClient.get<{ data: DocumentRecord & { signature_requests?: any[] } }>(`/documents/${id}`);
    return response.data;
  },
  async upload(input: { title: string; file: File }) {
    const formData = new FormData();
    formData.set("title", input.title);
    formData.set("file", input.file);
    const response = await apiClient.post<{ data: DocumentRecord }>("/documents", formData);
    return response.data;
  },
  async remove(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/documents/${id}`);
  },
  async sendDocument(id: string, payload: { signers: Array<{ email: string; name?: string; signingOrder?: number }>; expiresInDays: number }) {
    const response = await apiClient.post<{ data: any }>(`/documents/${id}/send`, payload);
    return response.data;
  }
};
