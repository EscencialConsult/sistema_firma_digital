import { ShieldCheck } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { APP_CONFIG } from "../../shared/config/app";
import { useAuth } from "../providers/AuthProvider";

export function AuthLayout() {
  const { user } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden border-r border-zinc-200 bg-white px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-950 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">{APP_CONFIG.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{APP_CONFIG.company}</p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Firma electronica segura
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-normal text-zinc-950">
              Gestiona contratos, verifica identidades y firma documentos en un solo lugar.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-zinc-600">
              Un portal simple para usuarios y administradores, con trazabilidad,
              verificacion de identidad y PDFs firmados listos para consultar.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {["KYC", "Contratos", "Auditoria"].map((item) => (
                <div key={item} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-xs font-semibold text-zinc-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-mono text-zinc-400">v{APP_CONFIG.version}</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-950 text-white">
                <ShieldCheck size={21} />
              </div>
              <div>
                <p className="text-sm font-bold leading-none">{APP_CONFIG.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{APP_CONFIG.company}</p>
              </div>
            </div>

            <Outlet />

            <p className="mt-6 text-center text-[11px] font-mono text-zinc-400 lg:hidden">
              v{APP_CONFIG.version}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
