import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchProfile, login, register } from "./auth.service";
import { supabase } from "../lib/supabase";

// Get reference to the mock client defined in setup.ts
const mockedSupabase = vi.mocked(supabase);

describe("Auth Service Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchProfile", () => {
    it("should successfully map a profile and use the status from public.users if RPC is empty", async () => {
      // Mock profile fetch from public.users
      mockedSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "user-123",
            email: "test@example.com",
            full_name: "John Doe",
            role: "USER",
            verification_status: "VERIFIED",
            certificate_status: "NONE",
            organization_id: "org-456",
            terms_accepted_at: null,
          },
          error: null,
        }),
      } as any);

      // Mock get_my_kyc_status RPC returning empty/null status
      (mockedSupabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      const profile = await fetchProfile("user-123", null);

      expect(profile).not.toBeNull();
      expect(profile?.id).toBe("user-123");
      expect(profile?.email).toBe("test@example.com");
      expect(profile?.fullName).toBe("John Doe");
      expect(profile?.verificationStatus).toBe("VERIFIED"); // Uses DB users status
      expect(profile?.organizationId).toBe("org-456");
    });

    it("should override user verificationStatus with realStatus from get_my_kyc_status RPC if present", async () => {
      // Mock profile fetch from public.users returning VERIFIED
      mockedSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "user-123",
            email: "test@example.com",
            full_name: "John Doe",
            role: "USER",
            verification_status: "VERIFIED",
            certificate_status: "NONE",
          },
          error: null,
        }),
      } as any);

      // Mock get_my_kyc_status RPC returning IN_REVIEW
      (mockedSupabase.rpc as any).mockResolvedValueOnce({
        data: { status: "IN_REVIEW" },
        error: null,
      } as any);

      const profile = await fetchProfile("user-123", null);

      expect(profile).not.toBeNull();
      expect(profile?.verificationStatus).toBe("IN_REVIEW"); // Overridden by RPC!
    });

    it("should fallback to fallbackProfile if supabase fetch fails", async () => {
      mockedSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "DB Error" } as any,
        }),
      } as any);

      (mockedSupabase.rpc as any).mockResolvedValueOnce({ data: null, error: null } as any);

      const fallbackUser = {
        email: "fallback@example.com",
        user_metadata: { full_name: "Fallback Name" },
      };

      const profile = await fetchProfile("user-123", fallbackUser);

      expect(profile).not.toBeNull();
      expect(profile?.fullName).toBe("Fallback Name");
      expect(profile?.verificationStatus).toBe("PENDING");
    });
  });

  describe("login", () => {
    it("should sign in and return profile successfully", async () => {
      (mockedSupabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: {
          user: { id: "user-123", email: "test@example.com" } as any,
          session: {} as any,
        },
        error: null,
      } as any);

      // Mock fetchProfile's internal calls
      mockedSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "user-123",
            email: "test@example.com",
            full_name: "John Doe",
            role: "USER",
            verification_status: "VERIFIED",
            certificate_status: "NONE",
          },
          error: null,
        }),
      } as any);
      (mockedSupabase.rpc as any).mockResolvedValueOnce({ data: null, error: null } as any);

      const profile = await login("test@example.com", "password");

      expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
      });
      expect(profile.id).toBe("user-123");
      expect(profile.fullName).toBe("John Doe");
    });

    it("should throw a helpful error when invalid credentials are provided", async () => {
      (mockedSupabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" } as any,
      } as any);

      await expect(login("test@example.com", "wrong")).rejects.toThrow("Email o contraseña incorrectos.");
    });
  });
});
