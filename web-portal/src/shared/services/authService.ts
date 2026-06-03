import { apiClient, apiRequest, clearSessionTokens, getRefreshToken, setSessionTokens } from "./apiClient";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN" | "ORGANIZATION_ADMIN";
  verificationStatus: string;
  certificateStatus: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function login(email: string, password: string) {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setSessionTokens(response.accessToken, response.refreshToken);
  return response.user;
}

export async function register(input: { fullName: string; email: string; password: string; organizationName?: string }) {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
  setSessionTokens(response.accessToken, response.refreshToken);
  return response.user;
}

export async function fetchMe() {
  const response = await apiRequest<{ data: any }>("/users/me");
  return {
    id: response.data.id,
    email: response.data.email,
    fullName: response.data.full_name,
    role: response.data.role,
    verificationStatus: response.data.verification_status,
    certificateStatus: response.data.certificate_status
  } satisfies AuthUser;
}

export async function logoutLocal() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiClient.post("/auth/logout", { refreshToken }).catch(() => undefined);
  }
  clearSessionTokens();
}
