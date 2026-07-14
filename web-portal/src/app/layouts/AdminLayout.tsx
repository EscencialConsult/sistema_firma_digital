import { useState } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";
import { SharedSidebar } from "../../shared/components/ui/SharedSidebar";
import { SharedHeader } from "../../shared/components/ui/SharedHeader";
import { OnboardingTour } from "../../shared/components/onboarding/OnboardingTour";
import { ShieldCheck, IdCard, ClipboardList, Users, FileText } from "lucide-react";

const ADMIN_MOBILE_NAV = [
  { path: "/admin",           label: "Panel",       icon: ShieldCheck,   end: true },
  { path: "/admin/kyc",       label: "KYC",         icon: IdCard },
  { path: "/admin/contracts", label: "Contratos",   icon: ClipboardList },
  { path: "/admin/users",     label: "Usuarios",     icon: Users },
  { path: "/dashboard",       label: "Firmas",       icon: FileText },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div
      className="min-h-screen text-[var(--color-text-base)] pb-20 lg:pb-0"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        backgroundImage: "linear-gradient(var(--brand-primary-soft), var(--brand-primary-soft))",
        transition: "background-image 0.35s ease",
      }}
    >
      <SharedSidebar 
        variant="admin" 
        mobileOpen={mobileOpen} 
        onMobileClose={() => setMobileOpen(false)} 
      />

      <div className="lg:pl-64">
        <SharedHeader 
          variant="admin" 
          onMobileOpen={() => setMobileOpen(true)} 
          showSearch={true} 
        />

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6">
          <div className="page-transition-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Barra de navegación inferior premium para administradores en móviles */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden glass-premium border-t border-zinc-200/60 pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-center justify-around px-2">
          {ADMIN_MOBILE_NAV.map(({ path, label, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl text-xs font-medium transition-all duration-300 mobile-tap-effect ${
                  isActive
                    ? "brand-text font-semibold"
                    : "text-zinc-400 hover:text-zinc-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className={isActive ? "brand-text stroke-[2.2px]" : "text-zinc-400"} />
                  <span className="text-[10px] tracking-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {location.pathname === "/admin" && <OnboardingTour variant="admin" />}
    </div>
  );
}
