import { useState } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";
import { FileText, X, Gauge, History, UserCircle } from "lucide-react";
import { SharedSidebar } from "../../shared/components/ui/SharedSidebar";
import { SharedHeader } from "../../shared/components/ui/SharedHeader";
import { OnboardingTour } from "../../shared/components/onboarding/OnboardingTour";
import { TERMS_TEXT } from "../../shared/legal/terms";

const MOBILE_NAV = [
  { path: "/dashboard",  label: "Inicio",      icon: Gauge,      end: true },
  { path: "/signatures", label: "Contratos",   icon: FileText },
  { path: "/audit",      label: "Historial",   icon: History },
  { path: "/profile",    label: "Mi Perfil",   icon: UserCircle },
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const location = useLocation();

  return (
    <div
      className="min-h-screen text-[var(--color-text-base)] pb-20 lg:pb-0"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        backgroundImage: "linear-gradient(var(--brand-primary-soft), var(--brand-primary-soft))",
        transition: "background-image 0.35s ease",
      }}
    >
      <SharedSidebar 
        variant="user" 
        mobileOpen={mobileOpen} 
        onMobileClose={() => setMobileOpen(false)} 
        onTermsClick={() => setTermsOpen(true)} 
      />

      <div className="lg:pl-64">
        <SharedHeader 
          variant="user" 
          onMobileOpen={() => setMobileOpen(true)} 
          showSearch={true} 
        />

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6">
          <div className="page-transition-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Barra de navegación inferior premium para móviles */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden glass-premium border-t border-zinc-200/60 pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-center justify-around px-2">
          {MOBILE_NAV.map(({ path, label, icon: Icon, end }) => (
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

      {location.pathname === "/dashboard" && <OnboardingTour variant="user" />}

      {termsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="page-transition-enter max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-[var(--radius-card)] border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-[var(--radius-button)] bg-zinc-950 text-white">
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
                className="grid h-9 w-9 place-items-center rounded-[var(--radius-button)] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
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
                className="primary-action px-5 py-2"
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
