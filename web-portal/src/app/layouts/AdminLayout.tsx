import {
  ClipboardList,
  FileClock,
  IdCard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { getMyOrganization } from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Panel de Administración",
  ORG_ADMIN: "Panel de Organización",
};

const ADMIN_NAV = [
  { path: "/admin",          label: "Panel general",      icon: ShieldCheck,  end: true },
  { path: "/admin/users",    label: "Usuarios",           icon: Users },
  { path: "/admin/kyc",      label: "Verificaciones KYC", icon: IdCard },
  { path: "/admin/contracts",label: "Contratos",          icon: ClipboardList },
  { path: "/admin/audit",    label: "Auditoría",          icon: FileClock },
  { path: "/admin/team",     label: "Mi equipo",          icon: UsersRound },
  { path: "/admin/settings", label: "Configuración",      icon: Settings },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    getMyOrganization().then(setOrg).catch(() => setOrg(null));
  }, []);

  const sidebar = (
    <>
      <div className="mb-8 flex items-center gap-3 px-2">
        <OrgLogo
          logoDarkUrl={org?.logoDarkUrl}
          logoLightUrl={org?.logoLightUrl}
          variant="light"
          size={40}
        />
        <div>
          <p className="text-sm font-bold text-zinc-900 leading-none truncate">{org?.name ?? "Admin Panel"}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Panel de administración</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {ADMIN_NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-200 ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs font-semibold text-zinc-800 truncate">{user?.fullName}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500 truncate">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-500 transition"
          type="button"
        >
          <LogOut size={12} />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-zinc-200 bg-white px-4 py-5 lg:flex">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-white px-4 py-5">
            <button onClick={() => setMobileOpen(false)} className="mb-4 self-end rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" type="button">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-100 lg:hidden" type="button">
              <Menu size={16} />
            </button>
            <p className="text-sm font-semibold text-zinc-600">
              {ROLE_LABEL[user?.role ?? ""] ?? "Panel de Administración"}
            </p>
            <div className="w-9" />
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
