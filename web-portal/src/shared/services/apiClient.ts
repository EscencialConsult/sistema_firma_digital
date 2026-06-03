const API_BASE = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:4000/api";

export function getAccessToken() {
  return localStorage.getItem("accessToken");
}

export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

export function setSessionTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearSessionTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) {
    clearSessionTokens();
    return false;
  }
  const data = await response.json() as { accessToken: string; refreshToken: string };
  setSessionTokens(data.accessToken, data.refreshToken);
  return true;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });

  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, options, false);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (response.status === 401) clearSessionTokens();
    throw new Error(error?.message ?? `Error HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  return request<T>(path, options);
}

export const apiClient = {
  get<T>(path: string, options: RequestInit = {}) {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body?: unknown, options: RequestInit = {}) {
    const isFormData = body instanceof FormData;
    return request<T>(path, {
      ...options,
      method: "POST",
      body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body)
    });
  },
  patch<T>(path: string, body?: unknown, options: RequestInit = {}) {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  },
  delete<T>(path: string, options: RequestInit = {}) {
    return request<T>(path, { ...options, method: "DELETE" });
  }
};
