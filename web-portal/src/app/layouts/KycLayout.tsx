import { LogOut, ShieldCheck } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function KycLayout() {
  const { user, logout } = useAuth();

  // Verified users, and users already waiting for review, don't need to stay in KYC.
  if (user?.verificationStatus === "VERIFIED" || user?.verificationStatus === "IN_REVIEW") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-950">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-950 leading-none">Firma Digital</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Verificación de identidad</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-zinc-500 hidden sm:block truncate max-w-[160px]">{user?.email}</p>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition"
              type="button"
            >
              <LogOut size={14} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
