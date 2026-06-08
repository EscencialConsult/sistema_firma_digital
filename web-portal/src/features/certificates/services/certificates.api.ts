import { apiClient, getAccessToken } from "../../../shared/services/apiClient";

export type CertificateRecord = {
  id: string;
  label: string;
  type: string;
  issuer?: string;
  subject?: string;
  serial_number?: string;
  fingerprint_sha256?: string;
  status: string;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type CreateCertificateInput = {
  label: string;
  type: "P12" | "PFX";
  password: string;
};

export const certificatesApi = {
  async list() {
    const response = await apiClient.get<{ data: CertificateRecord[] }>("/certificates");
    return response.data;
  },
  async create(input: CreateCertificateInput) {
    const response = await apiClient.post<{ data: CertificateRecord }>("/certificates", input);
    return response.data;
  },
  async updateStatus(id: string, status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "REVOKED") {
    const response = await apiClient.patch<{ data: CertificateRecord }>(`/certificates/${id}/status`, { status });
    return response.data;
  },
  async download(id: string, filename: string) {
    const apiBase = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:4000/api";
    const token = getAccessToken();
    const response = await fetch(`${apiBase}/certificates/${id}/download`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message ?? `Error HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
};
