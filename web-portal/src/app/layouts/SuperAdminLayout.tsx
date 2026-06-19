import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SharedSidebar } from "../../shared/components/ui/SharedSidebar";
import { SharedHeader } from "../../shared/components/ui/SharedHeader";

export function SuperAdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <SharedSidebar 
        variant="super-admin" 
        mobileOpen={mobileOpen} 
        onMobileClose={() => setMobileOpen(false)} 
      />

      <div className="lg:pl-64">
        <SharedHeader 
          variant="super-admin" 
          onMobileOpen={() => setMobileOpen(true)} 
          showSearch={false} 
        />

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-6">
          <div className="page-transition-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
