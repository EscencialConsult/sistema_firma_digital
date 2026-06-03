import { apiClient } from "../../../shared/services/apiClient";
import type { IdentityVerification } from "../../identity/types/identity.types";

export type AdminStats = {
  users: number;
  documents: number;
  signatureRequests: number;
  identityPending: number;
  organizations: number;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  verification_status: string;
  certificate_status: string;
  created_at: string;
};

export type AdminUserDetail = {
  user: AdminUserRecord;
  documents: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  certificates: Array<{
    id: string;
    label: string;
    status: string;
    issuer?: string;
    valid_to?: string;
  }>;
  identity: {
    id: string;
    status: string;
    document_type?: string;
    document_number?: string;
    submitted_at?: string;
    rejection_reason?: string;
  } | null;
};

export const adminApi = {
  async stats() {
    const response = await apiClient.get<{ data: AdminStats }>("/admin/stats");
    return response.data;
  },
  async listUsers() {
    const response = await apiClient.get<{ data: AdminUserRecord[] }>("/admin/users");
    return response.data;
  },
  async getUserDetails(id: string) {
    const response = await apiClient.get<{ data: AdminUserDetail }>(`/admin/users/${id}`);
    return response.data;
  },
  async identityVerifications() {
    const response = await apiClient.get<{ data: IdentityVerification[] }>("/admin/identity-verifications");
    return response.data;
  },
  async approveIdentity(id: string) {
    const response = await apiClient.post<{ data: IdentityVerification }>(`/admin/identity-verifications/${id}/approve`, {});
    return response.data;
  },
  async rejectIdentity(id: string, reason: string) {
    const response = await apiClient.post<{ data: IdentityVerification }>(`/admin/identity-verifications/${id}/reject`, { reason });
    return response.data;
  }
};
