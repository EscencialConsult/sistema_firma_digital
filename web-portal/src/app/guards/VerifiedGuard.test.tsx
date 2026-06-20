import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerifiedGuard } from "./VerifiedGuard";
import { useAuth } from "../providers/AuthProvider";

// Mock react-router-dom components
vi.mock("react-router-dom", () => ({
  Navigate: vi.fn(({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />),
  Outlet: vi.fn(() => <div data-testid="outlet" />),
}));

// Mock AuthProvider hook
vi.mock("../providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

describe("VerifiedGuard Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display verification loader when session loading is true", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    } as any);

    render(<VerifiedGuard />);

    expect(screen.getByText("Verificando identidad...")).toBeInTheDocument();
  });

  it("should redirect to login if user is not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as any);

    render(<VerifiedGuard />);

    const navigateEl = screen.getByTestId("navigate");
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute("data-to")).toBe("/login");
  });

  it("should bypass KYC and allow access to admins / super admins", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1", role: "ADMIN", verificationStatus: "PENDING" },
      loading: false,
    } as any);

    render(<VerifiedGuard />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("should redirect to /kyc if status is PENDING", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", role: "USER", verificationStatus: "PENDING" },
      loading: false,
    } as any);

    render(<VerifiedGuard />);

    const navigateEl = screen.getByTestId("navigate");
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute("data-to")).toBe("/kyc");
  });

  it("should redirect to /kyc if status is IN_REVIEW", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", role: "USER", verificationStatus: "IN_REVIEW" },
      loading: false,
    } as any);

    render(<VerifiedGuard />);

    const navigateEl = screen.getByTestId("navigate");
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute("data-to")).toBe("/kyc");
  });

  it("should redirect to /kyc/rejected if status is REJECTED", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", role: "USER", verificationStatus: "REJECTED" },
      loading: false,
    } as any);

    render(<VerifiedGuard />);

    const navigateEl = screen.getByTestId("navigate");
    expect(navigateEl).toBeInTheDocument();
    expect(navigateEl.getAttribute("data-to")).toBe("/kyc/rejected");
  });

  it("should render outlet and allow access if status is VERIFIED", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", role: "USER", verificationStatus: "VERIFIED" },
      loading: false,
    } as any);

    render(<VerifiedGuard />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });
});
