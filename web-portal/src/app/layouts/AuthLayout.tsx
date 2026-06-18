import { ShieldCheck } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { APP_CONFIG } from "../../shared/config/app";

export function AuthLayout() {
  const { user } = useAuth();

  // Already logged in → go to app
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-white leading-none">{APP_CONFIG.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{APP_CONFIG.company}</p>
          </div>
        </div>
        <Outlet />
        <p className="mt-6 text-center text-[11px] font-mono text-zinc-700 select-none">
          v{APP_CONFIG.version}
        </p>
      </div>
    </div>
  );
}
