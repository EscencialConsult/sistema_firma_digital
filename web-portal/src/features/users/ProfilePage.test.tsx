import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";
import { useAuth } from "../../app/providers/AuthProvider";
import { getMyVerification } from "../../shared/services/kyc.service";
import { supabase } from "../../shared/lib/supabase";

// Mock useNavigate
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

// Mock useAuth
vi.mock("../../app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

// Mock kyc.service
vi.mock("../../shared/services/kyc.service", () => ({
  getMyVerification: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockGetMyVerification = vi.mocked(getMyVerification);
const mockSupabase = vi.mocked(supabase);

describe("ProfilePage Tests", () => {
  const mockUser = {
    id: "user-123",
    fullName: "Santiago N.",
    email: "sncarp2003@gmail.com",
    role: "USER",
    verificationStatus: "VERIFIED",
    certificateStatus: "ACTIVE",
  };

  const mockUpdateUser = vi.fn();
  const mockReloadUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      updateUser: mockUpdateUser,
      reloadUser: mockReloadUser,
    } as any);

    // Mock getMyVerification returning no personal data (null) but verified status
    mockGetMyVerification.mockResolvedValue({
      id: "verif-123",
      userId: "user-123",
      status: "VERIFIED",
      personalData: null,
      documents: [],
    } as any);

    // Mock supabase select user data returning null for custom columns
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          full_name: "Santiago N.",
          document_number: null,
          cuil_cuit: null,
          birth_date: null,
          phone: null,
          address: null,
        },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    } as any);
  });

  it("should render profile basics (name and email)", async () => {
    render(<ProfilePage />);

    expect(screen.getByText("Mi perfil")).toBeInTheDocument();
    
    // Wait for the verification load to finish
    await waitFor(() => {
      expect(screen.queryByText("Cargando datos de identidad...")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("Santiago N.").length).toBeGreaterThan(0);
    expect(screen.getByText("sncarp2003@gmail.com")).toBeInTheDocument();
  });

  it("should use fallback data with placeholders if KYC details are empty in the database but status is VERIFIED", async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.queryByText("Cargando datos de identidad...")).not.toBeInTheDocument();
    });

    // Check fallback logic (should display verified fields with "—")
    expect(screen.getAllByText("Nombre completo").length).toBeGreaterThan(0);
    expect(screen.getByText("Número de DNI")).toBeInTheDocument();
    expect(screen.getByText("CUIL/CUIT")).toBeInTheDocument();
    
    // Check that placeholders "—" are present in the document
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("should allow editing and saving full name", async () => {
    // Mock update query
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockImplementation(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any) => resolve({ error: null }),
    }));
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: updateMock,
      eq: eqMock,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    render(<ProfilePage />);

    // Change full name input
    const input = screen.getByPlaceholderText("Tu nombre completo");
    fireEvent.change(input, { target: { value: "Santiago New Name" } });

    // Submit form
    const saveButton = screen.getByRole("button", { name: /Guardar cambios/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ full_name: "Santiago New Name" });
      expect(eqMock).toHaveBeenCalledWith("id", "user-123");
      expect(mockReloadUser).toHaveBeenCalled();
    });
  });
});
