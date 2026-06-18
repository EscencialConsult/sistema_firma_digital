import {
  Bell,
  FileText,
  Files,
  Gauge,
  History,
  LogOut,
  Menu,
  PenLine,
  UserCircle,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { TERMS_TEXT } from "../../shared/legal/terms";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";
import { getMyOrganization } from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";

const USER_NAV = [
  { path: "/dashboard",  label: "Dashboard",      icon: Gauge,  end: true },
  { path: "/signatures", label: "Por firmar",      icon: PenLine },
  { path: "/documents",  label: "Mis documentos",  icon: Files },
  { path: "/audit",      label: "Historial",       icon: History },
  { path: "/profile",    label: "Perfil",          icon: UserCircle },
];

const ADMIN_EXTRA = [{ path: "/admin", label: "Panel admin", icon: UsersRound }];

function NavItem({ path, label, icon: Icon, end }: { path: string; label: string; icon: React.ElementType; end?: boolean }) {
  return (
    <NavLink
      to={path}
      end={end}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-200 active:scale-[0.98] ${
          isActive
            ? "bg-zinc-900 text-white shadow-sm"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);

  const isAdmin = user?.role === "ADMIN" || user?.role === "ORG_ADMIN";
  const navItems = isAdmin ? [...USER_NAV, ...ADMIN_EXTRA] : USER_NAV;
  const verificationLabel = user?.verificationStatus === "VERIFIED" ? "Verificado" : "KYC pendiente";

  useEffect(() => {
    if (!user?.organizationId) return;
    getMyOrganization().then(setOrg).catch(() => setOrg(null));
  }, [user?.organizationId]);

  const sidebar = (
    <>
      <div className="mb-8 flex items-center gap-3 px-2">
        <OrgLogo
          logoDarkUrl={org?.logoDarkUrl}
          logoLightUrl={org?.logoLightUrl}
          variant="light"
          size={40}
        />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-none truncate">
            {org?.name ?? "Firma Digital"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{user?.email}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}
      </nav>

      <div className="mt-auto space-y-2">
        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <FileText size={12} />
          Términos y condiciones
        </button>

      <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50 p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-semibold text-zinc-900 truncate">{user?.fullName}</p>
        </div>
        <p className="text-[11px] text-zinc-500 capitalize">
          {user?.role?.toLowerCase()} · {verificationLabel}
        </p>
      </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-zinc-200/50 bg-white/80 px-4 py-5 backdrop-blur-md lg:flex">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-white px-4 py-5">
            <button
              onClick={() => setMobileOpen(false)}
              className="mb-4 self-end rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
              type="button"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-zinc-200/60 bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 lg:hidden"
              type="button"
            >
              <Menu size={16} />
            </button>
            <div className="flex flex-1 items-center gap-2 lg:justify-end">
              <button
                className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition"
                type="button"
                title="Notificaciones"
              >
                <Bell size={16} />
              </button>
              <button
                className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-red-600 transition"
                type="button"
                title="Cerrar sesión"
                onClick={logout}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>

      {termsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 px-4 py-6">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-950 text-white">
                  <FileText size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950">Términos y condiciones</h3>
                  <p className="text-xs text-zinc-500">Firma Digital Portal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Cerrar términos y condiciones"
              >
                <X size={17} />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-auto p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-700">
                {TERMS_TEXT}
              </pre>
            </div>

            <div className="flex justify-end border-t border-zinc-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
