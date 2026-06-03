import { Bell, LockKeyhole, LogOut, Search, ShieldCheck } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { routes } from "../router/routes";
import { AdminPage } from "../../features/admin/AdminPage";
import { AuditPage } from "../../features/audit/AuditPage";
import { CertificatesPage } from "../../features/certificates/CertificatesPage";
import { ConformityPage } from "../../features/conformity/ConformityPage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { DocumentsPage } from "../../features/documents/DocumentsPage";
import { IdentityPage } from "../../features/identity/IdentityPage";
import { ProfilePage } from "../../features/users/ProfilePage";
import { SignaturesPage } from "../../features/signatures/SignaturesPage";
import type { RouteId } from "../../shared/types/navigation";
import { useAuth } from "../providers/AuthProvider";
import { AuthScreen } from "../../features/auth/AuthScreen";
import { PublicSigningPage } from "../../features/signatures/PublicSigningPage";

const pageByRoute: Record<RouteId, ReactNode> = {
  dashboard: <DashboardPage />,
  documents: <DocumentsPage />,
  signatures: <SignaturesPage />,
  conformity: <ConformityPage />,
  identity: <IdentityPage />,
  certificates: <CertificatesPage />,
  audit: <AuditPage />,
  profile: <ProfilePage />,
  admin: <AdminPage />,
  login: null,
  register: null
};

export function PortalShell() {
  const { user, loading, logout } = useAuth();
  const [activeRoute, setActiveRoute] = useState<RouteId>("dashboard");
  const visibleRoutes = useMemo(() => routes.filter((route) => {
    if (route.hidden) return false;
    if (route.id === "admin" && user?.role !== "ADMIN") return false;
    return true;
  }), [user]);

  useEffect(() => {
    if (activeRoute === "admin" && user?.role !== "ADMIN") {
      setActiveRoute("dashboard");
    }
  }, [activeRoute, user]);

  const signToken = useMemo(() => {
    return new URLSearchParams(window.location.search).get("token");
  }, []);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-zinc-50 text-sm font-semibold text-zinc-500">Cargando sesión...</div>;
  }

  if (signToken) {
    return <PublicSigningPage token={signToken} />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-zinc-200/50 bg-white/80 backdrop-blur-md px-4 py-5 lg:block">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-950 text-white shadow-sm">
            <ShieldCheck size={22} />
          </div>
            <div>
              <p className="text-sm font-bold">Firma Digital</p>
              <p className="text-xs text-zinc-500">{user.role} - {user.verificationStatus}</p>
            </div>
        </div>

        <nav className="space-y-1">
          {visibleRoutes.map((route) => {
            const Icon = route.icon;
            const selected = route.id === activeRoute;
            return (
              <button
                key={route.id}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition duration-200 active:scale-[0.98] ${
                  selected ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-100/70 hover:text-zinc-900"
                }`}
                type="button"
                onClick={() => setActiveRoute(route.id)}
              >
                <Icon size={18} />
                {route.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-zinc-200/50 bg-zinc-50/40 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-zinc-950">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Seguridad activa
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            JWT, auditoría, hashes SHA-256 y enlaces de firma seguros.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-zinc-200/60 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-200/50 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-400 md:max-w-md hover:bg-zinc-100/40 transition duration-200 cursor-pointer">
              <Search size={16} />
              <span className="truncate">Buscar documentos, firmantes o auditorías</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right text-xs md:block">
                <p className="font-semibold text-zinc-800">{user.fullName}</p>
                <p className="text-zinc-400 font-mono">{user.email}</p>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200/50 bg-white text-zinc-500 hover:bg-zinc-50/50 hover:text-zinc-900 active:scale-[0.98] transition" type="button" title="Notificaciones">
                <Bell size={18} />
              </button>
              <button className="hidden rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 active:scale-[0.98] transition md:inline-flex" type="button" onClick={() => setActiveRoute("documents")}>
                Subir PDF
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200/50 bg-white text-zinc-500 hover:bg-zinc-50/50 hover:text-zinc-900 active:scale-[0.98] transition" type="button" title="Cerrar sesión" onClick={logout}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8">
          {pageByRoute[activeRoute]}
        </main>
      </div>
    </div>
  );
}
