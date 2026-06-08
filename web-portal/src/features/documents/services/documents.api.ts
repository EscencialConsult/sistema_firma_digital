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

export type Pkcs11Certificate = {
  id: string;
  label?: string;
};

export type Pkcs11Token = {
  modulePath: string;
  moduleName: string;
  slot?: string;
  label?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  certificates: Pkcs11Certificate[];
  error?: string;
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
  },
  async detectPkcs11Tokens(pin?: string) {
    const query = pin ? `?pin=${encodeURIComponent(pin)}` : "";
    const response = await apiClient.get<{ data: { modulesChecked: string[]; tokens: Pkcs11Token[] } }>(`/documents/pkcs11/tokens${query}`);
    return response.data;
  },
  async signWithPkcs11(id: string, payload: { pin: string; certId?: string; modulePath?: string; slot?: string; metadata?: Record<string, unknown> }) {
    const response = await apiClient.post<{ data: any }>(`/documents/${id}/sign/pkcs11`, payload);
    return response.data;
  }
};
