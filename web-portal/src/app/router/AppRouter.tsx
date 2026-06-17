import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { AuthGuard } from "../guards/AuthGuard";
import { VerifiedGuard } from "../guards/VerifiedGuard";
import { AdminGuard } from "../guards/AdminGuard";
import { AuthLayout } from "../layouts/AuthLayout";
import { KycLayout } from "../layouts/KycLayout";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";

const LoginPage = lazy(() =>
  import("../../features/auth/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("../../features/auth/RegisterPage").then((m) => ({ default: m.RegisterPage }))
);
const KycWizardPage = lazy(() =>
  import("../../features/kyc/KycWizardPage").then((m) => ({ default: m.KycWizardPage }))
);
const KycPendingPage = lazy(() =>
  import("../../features/kyc/KycPendingPage").then((m) => ({ default: m.KycPendingPage }))
);
const KycRejectedPage = lazy(() =>
  import("../../features/kyc/KycRejectedPage").then((m) => ({ default: m.KycRejectedPage }))
);
const DashboardPage = lazy(() =>
  import("../../features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const ContractsPage = lazy(() =>
  import("../../features/contracts/ContractsPage").then((m) => ({ default: m.ContractsPage }))
);
const ContractDetailPage = lazy(() =>
  import("../../features/contracts/ContractDetailPage").then((m) => ({
    default: m.ContractDetailPage,
  }))
);
const SigningFlowPage = lazy(() =>
  import("../../features/signing/SigningFlowPage").then((m) => ({ default: m.SigningFlowPage }))
);
const AdminDashboardPage = lazy(() =>
  import("../../features/admin/AdminDashboardPage").then((m) => ({
    default: m.AdminDashboardPage,
  }))
);
const AdminUsersPage = lazy(() =>
  import("../../features/admin/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage }))
);
const AdminKycReviewPage = lazy(() =>
  import("../../features/admin/AdminKycReviewPage").then((m) => ({
    default: m.AdminKycReviewPage,
  }))
);
const AdminContractsPage = lazy(() =>
  import("../../features/admin/AdminContractsPage").then((m) => ({
    default: m.AdminContractsPage,
  }))
);
const AdminAuditPage = lazy(() =>
  import("../../features/admin/AdminAuditPage").then((m) => ({ default: m.AdminAuditPage }))
);

function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-zinc-400">
      Cargando...
    </div>
  );
}

export function AppRouter() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950 text-sm font-semibold text-zinc-500">
        Cargando sesión...
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public: auth pages */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Auth required */}
        <Route element={<AuthGuard />}>
          {/* KYC: only for non-verified users */}
          <Route element={<KycLayout />}>
            <Route path="/kyc" element={<KycWizardPage />} />
            <Route path="/kyc/pending" element={<KycPendingPage />} />
            <Route path="/kyc/rejected" element={<KycRejectedPage />} />
          </Route>

          {/* Verified required */}
          <Route element={<VerifiedGuard />}>
            {/* Full-screen signing (no sidebar) */}
            <Route path="/signing/:id" element={<SigningFlowPage />} />

            {/* Main app with sidebar */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/contracts/:id" element={<ContractDetailPage />} />
            </Route>

            {/* Admin only */}
            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/kyc" element={<AdminKycReviewPage />} />
                <Route path="/admin/contracts" element={<AdminContractsPage />} />
                <Route path="/admin/audit" element={<AdminAuditPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="/" element={<DefaultRedirect />} />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </Suspense>
  );
}
