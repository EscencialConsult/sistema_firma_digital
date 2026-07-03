import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PublicSigningPage } from "./PublicSigningPage";
import { useAuth } from "../../app/providers/AuthProvider";
import { supabase } from "../../shared/lib/supabase";

// Mock useAuth
vi.mock("../../app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockSupabase = vi.mocked(supabase);

describe("PublicSigningPage Tests", () => {
  const mockUser = {
    id: "user-123",
    email: "signer@example.com",
    verificationStatus: "VERIFIED",
  };

  const mockRequestDetails = {
    id: "req-123",
    document_id: "doc-123",
    signer_email: "signer@example.com",
    signer_name: "John Signer",
    status: "PENDING",
    accepted_conformity: false,
    document: {
      title: "Contrato de Prueba",
      document_versions: [{ storage_path: "path/to/pdf.pdf" }]
    },
    current_version: {
      file_name: "contrato.pdf",
      sha256_hash: "mockhash1234567890",
      storage_path: "path/to/pdf.pdf"
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
    } as any);

    // Mock PDF storage URL creation
    mockSupabase.storage = {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/pdf" }, error: null } as any),
      }),
    } as any;

    // Mock fetch for PDF load
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["PDF CONTENT"], { type: "application/pdf" })),
    } as any);

    // Mock URL.createObjectURL and URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => "blob:https://example.com/pdf-blob");
    globalThis.URL.revokeObjectURL = vi.fn();

    // Default supabase mock for request loading
    (mockSupabase.rpc as any).mockImplementation((name: string) => {
      if (name === "get_signature_request_by_token") {
        return Promise.resolve({ data: mockRequestDetails, error: null } as any);
      }
      return Promise.resolve({ data: null, error: null } as any);
    });

    (mockSupabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRequestDetails, error: null } as any),
      update: vi.fn().mockReturnThis(),
    } as any);
  });

  it("should render document details and signature preview after loading", async () => {
    render(<PublicSigningPage token="test-token" />);

    // Loader is displayed initially
    expect(screen.getByText("Verificando solicitud de firma segura...")).toBeInTheDocument();

    // Wait for the request to load
    await waitFor(() => {
      expect(screen.queryByText("Verificando solicitud de firma segura...")).not.toBeInTheDocument();
    });

    // Document title and signer info should be displayed
    expect(screen.getByText("Contrato de Prueba")).toBeInTheDocument();
    expect(screen.getAllByText("John Signer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("signer@example.com").length).toBeGreaterThan(0);
  });

  it("should enforce conformity acceptance before allowing signing", async () => {
    render(<PublicSigningPage token="test-token" />);

    await waitFor(() => {
      expect(screen.queryByText("Verificando solicitud de firma segura...")).not.toBeInTheDocument();
    });

    // Verify step 1: conformity
    expect(screen.getByText("Paso 1: Conformidad")).toBeInTheDocument();
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    const acceptBtn = screen.getByRole("button", { name: "Aceptar Conformidad" });
    expect(acceptBtn).toBeDisabled();

    // Check it and click accept
    fireEvent.click(checkbox);
    expect(acceptBtn).toBeEnabled();

    // Mock RPC for conformity acceptance success
    (mockSupabase.rpc as any).mockResolvedValueOnce({ data: true, error: null } as any);

    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText("Conformidad registrada")).toBeInTheDocument();
    });

    // Verify it transitions to Paso 2: firma digital
    expect(screen.getByText("Paso 2: Firma digital")).toBeInTheDocument();
  });

  it("should execute OTP generation and verification flow successfully", async () => {
    // Start with conformity already accepted
    const reqWithConformity = { ...mockRequestDetails, accepted_conformity: true };
    (mockSupabase.rpc as any).mockImplementation((name: string) => {
      if (name === "get_signature_request_by_token") {
        return Promise.resolve({ data: reqWithConformity, error: null } as any);
      }
      return Promise.resolve({ data: null, error: null } as any);
    });

    render(<PublicSigningPage token="test-token" />);

    await waitFor(() => {
      expect(screen.queryByText("Verificando solicitud de firma segura...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Conformidad registrada")).toBeInTheDocument();

    // Find and click the "Firmar Documento" button to request OTP
    const signBtn = screen.getByRole("button", { name: "Firmar Documento" });
    
    // Mock send-signing-email function call
    mockSupabase.functions.invoke = vi.fn().mockResolvedValue({
      data: { ok: true },
      error: null,
    } as any);

    fireEvent.click(signBtn);

    // Verify that send-signing-email was called with isOtpRequest: true
    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("send-signing-email", expect.objectContaining({
        body: expect.objectContaining({
          isOtpRequest: true,
          signerEmail: "signer@example.com",
          requestId: "req-123"
        })
      }));
    });

    // Screen should transition to OTP verification input
    expect(screen.getByText(/Hemos enviado un código de verificación/)).toBeInTheDocument();
    expect(screen.getByText("Código de verificación")).toBeInTheDocument();

    // Verify "Confirmar y Firmar" is disabled initially
    const confirmBtn = screen.getByRole("button", { name: "Confirmar y Firmar" });
    expect(confirmBtn).toBeDisabled();

    // Simulate entering 6-digit OTP code
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBe(6);

    // Fill the inputs with "123456"
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.change(inputs[1], { target: { value: "2" } });
    fireEvent.change(inputs[2], { target: { value: "3" } });
    fireEvent.change(inputs[3], { target: { value: "4" } });
    fireEvent.change(inputs[4], { target: { value: "5" } });
    fireEvent.change(inputs[5], { target: { value: "6" } });

    // Verify button is now enabled
    await waitFor(() => {
      expect(confirmBtn).toBeEnabled();
    });

    // Mock sign-document function call
    mockSupabase.functions.invoke = vi.fn().mockResolvedValue({
      data: { ok: true },
      error: null,
    } as any);

    // Click confirm
    fireEvent.click(confirmBtn);

    // Verify that sign-document was called with the OTP code
    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("sign-document", expect.objectContaining({
        body: expect.objectContaining({
          otp: "123456"
        })
      }));
    });

    // Component should transition to signed state
    await waitFor(() => {
      expect(screen.getByText("Firma criptográfica aplicada")).toBeInTheDocument();
    });
  });
});
