/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("auth session client", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the access token in memory after login", async () => {
    const { login } = await import("./authService");
    const { getAccessToken } = await import("./apiClient");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      accessToken: "access-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        fullName: "User One",
        role: "USER",
        verificationStatus: "PENDING",
        certificateStatus: "NONE"
      }
    }));

    await login("user@example.com", "password");

    expect(getAccessToken()).toBe("access-token");
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("refreshes the access token with HttpOnly cookie credentials", async () => {
    const { restoreAccessToken, getAccessToken } = await import("./apiClient");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ accessToken: "new-access-token" }));

    await expect(restoreAccessToken()).resolves.toBe(true);

    expect(getAccessToken()).toBe("new-access-token");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
  });

  it("clears legacy localStorage tokens on logout", async () => {
    const { logoutLocal } = await import("./authService");
    localStorage.setItem("accessToken", "legacy-access");
    localStorage.setItem("refreshToken", "legacy-refresh");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }));

    await logoutLocal();

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });
});
