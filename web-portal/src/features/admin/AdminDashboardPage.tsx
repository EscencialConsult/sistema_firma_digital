import {
  CheckCircle2,
  FileSignature,
  Files,
  IdCard,
  Users,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats, type AdminStats } from "../../shared/services/admin.service";

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats()
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las metricas.");
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        {
          icon: Users,
          label: "Usuarios totales",
          value: stats.totalUsers,
          sub: `${stats.verifiedUsers} verificados`,
          color: "text-blue-600",
          bg: "bg-blue-50/50",
          borderColor: "border-blue-100/70",
        },
        {
          icon: IdCard,
          label: "KYC pendientes",
          value: stats.pendingKyc,
          sub: "En espera de revisión",
          color: "text-amber-600",
          bg: "bg-amber-50/50",
          borderColor: "border-amber-100/70",
        },
        {
          icon: Files,
          label: "Contratos totales",
          value: stats.totalContracts,
          sub: `${stats.signedContracts} firmados`,
          color: "text-zinc-650",
          bg: "bg-zinc-50",
          borderColor: "border-zinc-200/70",
        },
        {
          icon: CheckCircle2,
          label: "Firmados",
          value: stats.signedContracts,
          sub: `${stats.pendingContracts} pendientes`,
          color: "text-emerald-600",
          bg: "bg-emerald-50/50",
          borderColor: "border-emerald-100/70",
        },
        {
          icon: XCircle,
          label: "Rechazados",
          value: stats.rejectedContracts,
          sub: "Contratos rechazados",
          color: "text-rose-600",
          bg: "bg-rose-50/50",
          borderColor: "border-rose-100/70",
        },
        {
          icon: FileSignature,
          label: "Tasa de firma",
          value: stats.totalContracts
            ? `${Math.round((stats.signedContracts / stats.totalContracts) * 100)}%`
            : "—",
          sub: "Documentos completados",
          color: "text-violet-600",
          bg: "bg-violet-50/50",
          borderColor: "border-violet-100/70",
        },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      <div className="border-b border-zinc-100 pb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Panel de administración
        </p>
        <h1 className="mt-1 text-3xl font-black text-zinc-950 tracking-tight">Resumen general</h1>
        <p className="mt-1.5 text-sm text-zinc-500 font-medium">
          Métricas en tiempo real del sistema de firma electrónica.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array(6)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-100/70 border border-zinc-100" />
              ))
          : cards.map(({ icon: Icon, label, value, sub, color, bg, borderColor }) => (
              <div
                key={label}
                className="group relative flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-300"
              >
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${borderColor} ${bg} transition-transform duration-300 group-hover:scale-105`}>
                  <Icon size={22} className={color} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
                  <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{value}</p>
                  <p className="text-[11px] font-semibold text-zinc-500">{sub}</p>
                </div>
              </div>
            ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revisar KYC", sub: "Aprobar o rechazar", path: "/admin/kyc", icon: IdCard },
          { label: "Ver usuarios", sub: "Gestionar cuentas", path: "/admin/users", icon: Users },
          { label: "Contratos", sub: "Todos los documentos", path: "/admin/contracts", icon: Files },
          { label: "Auditoría", sub: "Logs del sistema", path: "/admin/audit", icon: FileSignature },
        ].map(({ label, sub, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="group relative flex flex-col justify-between min-h-[140px] rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:border-zinc-300/80 hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex justify-between items-start w-full">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-zinc-950 group-hover:text-white transition-all duration-300 shadow-sm">
                <Icon size={18} />
              </div>
              <ArrowRight size={16} className="text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 mt-1" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-950">{label}</p>
              <p className="text-xs text-zinc-500 font-medium mt-1">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
