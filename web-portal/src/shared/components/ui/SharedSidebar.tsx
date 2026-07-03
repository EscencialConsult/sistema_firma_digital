import {
  Building2,
  ClipboardList,
  FileClock,
  FileText,
  Gauge,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getMyOrganization } from "../../services/organizations.service";
import type { Organization } from "../../types/organization";
import { OrgLogo } from "./OrgLogo";

type SidebarVariant = "user" | "admin" | "super-admin";

interface SharedSidebarProps {
  variant: SidebarVariant;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onTermsClick?: () => void;
}

const USER_NAV = [
  { path: "/dashboard",  label: "Dashboard",     icon: Gauge,      end: true },
  { path: "/signatures", label: "Mis contratos", icon: FileText },
  { path: "/audit",      label: "Historial",     icon: History },
  { path: "/profile",    label: "Perfil",        icon: UserCircle },
];

const ADMIN_EXTRA = [{ path: "/admin", label: "Panel admin", icon: UsersRound }];

const ADMIN_NAV = [
  { path: "/admin", label: "Panel general", icon: ShieldCheck, end: true },
  { path: "/admin/users", label: "Usuarios", icon: Users },
  { path: "/admin/kyc", label: "Verificaciones KYC", icon: IdCard },
  { path: "/admin/contracts", label: "Contratos", icon: ClipboardList },
  { path: "/admin/audit", label: "Auditoría", icon: FileClock },
  { path: "/admin/team", label: "Mi equipo", icon: UsersRound },
  { path: "/admin/settings", label: "Configuración", icon: Settings },
];

const SUPER_ADMIN_NAV = [
  { path: "/super-admin", label: "Panel general", icon: LayoutDashboard, end: true },
  { path: "/super-admin/organizations", label: "Organizaciones", icon: Building2 },
  { path: "/super-admin/settings", label: "Configuración", icon: Settings },
];

export function SharedSidebar({ variant, mobileOpen, onMobileClose, onTermsClick }: SharedSidebarProps) {
  const { user, logout } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    if (variant === "super-admin") return;
    if (!user?.organizationId && variant === "user") return;
    getMyOrganization().then(setOrg).catch(() => setOrg(null));
  }, [user?.organizationId, variant]);

  const isAdminOrOrgAdmin = user?.role === "ADMIN" || user?.role === "ORG_ADMIN";
  let navItems = USER_NAV;
  if (variant === "user") {
    navItems = isAdminOrOrgAdmin ? [...USER_NAV, ...ADMIN_EXTRA] : USER_NAV;
  } else if (variant === "admin") {
    navItems = ADMIN_NAV;
  } else if (variant === "super-admin") {
    navItems = SUPER_ADMIN_NAV;
  }

  const verificationLabel = user?.verificationStatus === "VERIFIED" ? "Verificado" : "KYC pendiente";

  // Theme styles based on variant
  const isDark = variant === "super-admin";
  const textPrimary = isDark ? "text-white" : "text-zinc-950";
  const textSecondary = isDark ? "text-zinc-500" : "text-zinc-500";
  const bgSidebarDesktop = isDark ? "bg-zinc-950 border-zinc-800/60" : "border-zinc-200/50 backdrop-blur-md";
  const bgSidebarMobile = isDark ? "bg-zinc-950" : "";
  const bgOverlay = isDark ? "bg-black/60" : "bg-black/40 backdrop-blur-sm";
  const brandSidebarStyle = isDark ? undefined : { background: "var(--brand-bg)", transition: "background 0.35s ease" };

  const getLinkClasses = (isActive: boolean) => {
    const base = "flex w-full items-center gap-3 rounded-[var(--radius-button)] px-3.5 py-2.5 text-sm font-medium transition duration-200 active:scale-[0.98]";
    if (isActive) {
      return isDark ? `${base} bg-white/10 text-white` : `${base} brand-nav-active shadow-sm`;
    }
    return isDark ? `${base} text-zinc-500 hover:bg-white/5 hover:text-zinc-300` : `${base} text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900`;
  };

  const renderHeader = () => {
    if (variant === "super-admin") {
      return (
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-button)] bg-white/10 border border-white/10">
            <Building2 size={19} className="text-white" />
          </div>
          <div>
            <p className={`text-sm font-bold leading-none ${textPrimary}`}>Escencial</p>
            <p className={`mt-0.5 text-[11px] ${textSecondary}`}>Super Admin</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-8 flex items-center gap-3 px-2">
        <OrgLogo
          logoDarkUrl={org?.logoDarkUrl}
          logoLightUrl={org?.logoLightUrl}
          variant="light"
          size={40}
        />
        <div className="min-w-0">
          <p className={`text-sm font-bold leading-none truncate ${textPrimary}`}>
            {org?.name ?? (variant === "admin" ? "Admin Panel" : "Firma Digital")}
          </p>
          <p className={`mt-0.5 truncate text-[11px] ${textSecondary}`}>
            {variant === "admin" ? "Panel de administración" : user?.email}
          </p>
        </div>
      </div>
    );
  };

  const renderFooter = () => {
    if (variant === "super-admin") {
      return (
        <div className="mt-auto rounded-[var(--radius-card)] border border-zinc-800 p-3">
          <p className="text-xs font-semibold text-zinc-300 truncate">{user?.fullName}</p>
          <p className="mt-0.5 text-[11px] text-zinc-600 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition"
            type="button"
          >
            <LogOut size={12} /> Cerrar sesión
          </button>
        </div>
      );
    }

    if (variant === "admin") {
      return (
        <div
          className="mt-auto rounded-[var(--radius-card)] border p-3"
          style={{
            borderColor: "var(--brand-accent)",
            backgroundColor: "var(--brand-accent-soft)",
            transition: "background-color 0.35s ease, border-color 0.35s ease",
          }}
        >
          <p className="text-xs font-semibold text-zinc-800 truncate">{user?.fullName}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-500 transition"
            type="button"
          >
            <LogOut size={12} /> Cerrar sesión
          </button>
        </div>
      );
    }

    return (
      <div className="mt-auto space-y-2">
        {onTermsClick && (
          <button
            type="button"
            onClick={onTermsClick}
            className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <FileText size={12} />
            Términos y condiciones
          </button>
        )}
        <div className="rounded-[var(--radius-card)] border border-zinc-200/60 bg-zinc-50 p-4">
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
    );
  };

  const sidebarContent = (
    <>
      {renderHeader()}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => getLinkClasses(isActive)}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
      {renderFooter()}
    </>
  );

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r px-4 py-5 lg:flex ${bgSidebarDesktop}`} style={brandSidebarStyle}>
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className={`absolute inset-0 ${bgOverlay}`} onClick={onMobileClose} />
          <aside className={`relative flex h-full w-72 flex-col px-4 py-5 ${bgSidebarMobile}`} style={brandSidebarStyle}>
            <button
              onClick={onMobileClose}
              className={`mb-4 self-end rounded-lg p-1.5 transition-colors ${isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100'}`}
              type="button"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
