import { apiClient } from "../../../shared/services/apiClient";
import type { AuthUser } from "../../../shared/services/authService";

export const usersApi = {
  async updateMe(fullName: string) {
    const response = await apiClient.patch<{ data: any }>("/users/me", { fullName });
    return {
      id: response.data.id,
      email: response.data.email,
      fullName: response.data.full_name,
      role: response.data.role,
      verificationStatus: response.data.verification_status,
      certificateStatus: response.data.certificate_status
    } satisfies AuthUser;
  }
};
