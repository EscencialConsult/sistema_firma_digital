import { Building2, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

const SUPER_ADMIN_NAV = [
  { path: "/super-admin",               label: "Panel general",   icon: LayoutDashboard, end: true },
  { path: "/super-admin/organizations", label: "Organizaciones",  icon: Building2 },
  { path: "/super-admin/settings",      label: "Configuración",   icon: Settings },
];

export function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 border border-white/10">
          <Building2 size={19} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Escencial</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Super Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {SUPER_ADMIN_NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-200 ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-zinc-800 p-3">
        <p className="text-xs font-semibold text-zinc-300 truncate">{user?.fullName}</p>
        <p className="mt-0.5 text-[11px] text-zinc-600 truncate">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition"
          type="button"
        >
          <LogOut size={12} />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-zinc-800/60 bg-zinc-950 px-4 py-5 lg:flex">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-zinc-950 px-4 py-5">
            <button
              onClick={() => setMobileOpen(false)}
              className="mb-4 self-end rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800"
              type="button"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-500 hover:bg-zinc-800 lg:hidden"
              type="button"
            >
              <Menu size={16} />
            </button>
            <p className="text-sm font-semibold text-zinc-400">Panel Super Administrador</p>
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
