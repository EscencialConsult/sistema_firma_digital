const API_BASE = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:4000/api";
const SESSION_EXPIRED_EVENT = "firmaDigital:session-expired";
let refreshPromise: Promise<boolean> | null = null;
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
  // Remove legacy tokens left by older portal builds.
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

function notifySessionExpired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function refreshSession() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include"
  });
  if (!response.ok) {
    clearAccessToken();
    notifySessionExpired();
    return false;
  }
  const data = await response.json() as { accessToken: string };
  setAccessToken(data.accessToken);
  return true;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
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
    if (response.status === 401) {
      clearAccessToken();
      notifySessionExpired();
    }
    throw new Error(error?.message ?? `Error HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  return request<T>(path, options);
}

export async function restoreAccessToken() {
  return refreshSession();
}

export function onSessionExpired(listener: () => void) {
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
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
