import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FileText, X } from "lucide-react";
import { SharedSidebar } from "../../shared/components/ui/SharedSidebar";
import { SharedHeader } from "../../shared/components/ui/SharedHeader";
import { OnboardingTour } from "../../shared/components/onboarding/OnboardingTour";
import { TERMS_TEXT } from "../../shared/legal/terms";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-base)]">
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
