import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { AuthGuard } from "../guards/AuthGuard";
import { VerifiedGuard } from "../guards/VerifiedGuard";
import { AdminGuard } from "../guards/AdminGuard";
import { SuperAdminGuard } from "../guards/SuperAdminGuard";
import { AuthLayout } from "../layouts/AuthLayout";
import { KycLayout } from "../layouts/KycLayout";
import { AppLayout } from "../layouts/AppLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { SuperAdminLayout } from "../layouts/SuperAdminLayout";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const LoginPage = lazy(() =>
  import("../../features/auth/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("../../features/auth/RegisterPage").then((m) => ({ default: m.RegisterPage }))
);

// ─── KYC ─────────────────────────────────────────────────────────────────────
const KycWizardPage = lazy(() =>
  import("../../features/kyc/KycWizardPage").then((m) => ({ default: m.KycWizardPage }))
);

const KycRejectedPage = lazy(() =>
  import("../../features/kyc/KycRejectedPage").then((m) => ({ default: m.KycRejectedPage }))
);

// ─── App principal ────────────────────────────────────────────────────────────
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
const SignaturesPage = lazy(() =>
  import("../../features/signatures/SignaturesPage").then((m) => ({ default: m.SignaturesPage }))
);
const DocumentsPage = lazy(() =>
  import("../../features/documents/DocumentsPage").then((m) => ({ default: m.DocumentsPage }))
);
const ProfilePage = lazy(() =>
  import("../../features/users/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);
const AuditPage = lazy(() =>
  import("../../features/audit/AuditPage").then((m) => ({ default: m.AuditPage }))
);
const SignatureAuditPage = lazy(() =>
  import("../../features/audit/SignatureAuditPage").then((m) => ({ default: m.SignatureAuditPage }))
);
const IdentityPage = lazy(() =>
  import("../../features/identity/IdentityPage").then((m) => ({ default: m.IdentityPage }))
);
const CertificatesPage = lazy(() =>
  import("../../features/certificates/CertificatesPage").then((m) => ({
    default: m.CertificatesPage,
  }))
);

// ─── Firma pública (sin login requerido) ──────────────────────────────────────
const PublicSigningPage = lazy(() =>
  import("../../features/signatures/PublicSigningPage").then((m) => ({
    default: m.PublicSigningPage,
  }))
);

// ─── Aceptación de autoridad (sin login requerido) ────────────────────────────
const AuthorityAcceptPage = lazy(() =>
  import("../../features/authority/AuthorityAcceptPage").then((m) => ({
    default: m.AuthorityAcceptPage,
  }))
);

// ─── Join org (sin login requerido) ───────────────────────────────────────────
const JoinOrgPage = lazy(() =>
  import("../../features/join/JoinOrgPage").then((m) => ({ default: m.JoinOrgPage }))
);

// ─── Super Admin ──────────────────────────────────────────────────────────────
const SuperAdminDashboardPage = lazy(() =>
  import("../../features/super-admin/SuperAdminDashboardPage").then((m) => ({
    default: m.SuperAdminDashboardPage,
  }))
);
const OrganizationsPage = lazy(() =>
  import("../../features/super-admin/OrganizationsPage").then((m) => ({
    default: m.OrganizationsPage,
  }))
);
const OrganizationNewPage = lazy(() =>
  import("../../features/super-admin/OrganizationNewPage").then((m) => ({
    default: m.OrganizationNewPage,
  }))
);
const OrganizationDetailPage = lazy(() =>
  import("../../features/super-admin/OrganizationDetailPage").then((m) => ({
    default: m.OrganizationDetailPage,
  }))
);
const SuperAdminSettingsPage = lazy(() =>
  import("../../features/super-admin/SuperAdminSettingsPage").then((m) => ({
    default: m.SuperAdminSettingsPage,
  }))
);

// ─── Admin ────────────────────────────────────────────────────────────────────
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
const AdminTeamPage = lazy(() =>
  import("../../features/admin/AdminTeamPage").then((m) => ({ default: m.AdminTeamPage }))
);
const AdminSettingsPage = lazy(() =>
  import("../../features/admin/AdminSettingsPage").then((m) => ({ default: m.AdminSettingsPage }))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "SUPER_ADMIN") return <Navigate to="/super-admin" replace />;
  if (user.role === "ADMIN" || user.role === "ORG_ADMIN") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-zinc-400">
      Cargando...
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
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

        {/* ── Públicas ── */}
        <Route element={<AuthLayout />}>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Firma pública (sin cuenta) */}
        <Route path="/sign/:id"    element={<PublicSigningPage />} />

        {/* Aceptar invitación de autoridad (sin cuenta) */}
        <Route path="/authority/accept/:token" element={<AuthorityAcceptPage />} />

        {/* Unirse a una organización (sin cuenta) */}
        <Route path="/join/:slug"  element={<JoinOrgPage />} />

        {/* ── Requieren login ── */}
        <Route element={<AuthGuard />}>

          {/* KYC (usuarios sin verificar) */}
          <Route element={<KycLayout />}>
            <Route path="/kyc"          element={<KycWizardPage />} />

            <Route path="/kyc/rejected" element={<KycRejectedPage />} />
          </Route>

          {/* App principal (con sidebar) - accesible sin verificación KYC */}
          <Route element={<AppLayout />}>
            <Route path="/profile"          element={<ProfilePage />} />
          </Route>

          {/* ── Requieren verificación KYC ── */}
          <Route element={<VerifiedGuard />}>

            {/* Firma (pantalla completa, sin sidebar) */}
            <Route path="/signing/:id" element={<SigningFlowPage />} />

            {/* App principal (con sidebar) */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard"        element={<DashboardPage />} />
              <Route path="/contracts"        element={<ContractsPage />} />
              <Route path="/contracts/:id"    element={<ContractDetailPage />} />
              <Route path="/signatures"       element={<SignaturesPage />} />
              <Route path="/documents"        element={<DocumentsPage />} />
              <Route path="/identity"         element={<IdentityPage />} />
              <Route path="/certificates"     element={<CertificatesPage />} />
              <Route path="/audit"            element={<AuditPage />} />
              <Route path="/audit/signature/:signatureId" element={<SignatureAuditPage />} />
            </Route>

            {/* ── Solo admins (ADMIN / ORG_ADMIN) ── */}
            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin"              element={<AdminDashboardPage />} />
                <Route path="/admin/users"        element={<AdminUsersPage />} />
                <Route path="/admin/kyc"          element={<AdminKycReviewPage />} />
                <Route path="/admin/contracts"    element={<AdminContractsPage />} />
                <Route path="/admin/audit"        element={<AdminAuditPage />} />
                <Route path="/admin/team"         element={<AdminTeamPage />} />
                <Route path="/admin/settings"     element={<AdminSettingsPage />} />
              </Route>
            </Route>

            {/* ── Solo SUPER_ADMIN (Escencial) ── */}
            <Route element={<SuperAdminGuard />}>
              <Route element={<SuperAdminLayout />}>
                <Route path="/super-admin"                       element={<SuperAdminDashboardPage />} />
                <Route path="/super-admin/organizations"         element={<OrganizationsPage />} />
                <Route path="/super-admin/organizations/new"     element={<OrganizationNewPage />} />
                <Route path="/super-admin/organizations/:id"     element={<OrganizationDetailPage />} />
                <Route path="/super-admin/settings"              element={<SuperAdminSettingsPage />} />
              </Route>
            </Route>

          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="/"  element={<DefaultRedirect />} />
        <Route path="*"  element={<DefaultRedirect />} />

      </Routes>
    </Suspense>
  );
}
