import {
  CheckCircle2,
  FileSignature,
  Files,
  IdCard,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../shared/components/ui/Button";
import { getAdminStats, type AdminStats } from "../../shared/services/admin.service";

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  const cards = stats
    ? [
        {
          icon: Users,
          label: "Usuarios totales",
          value: stats.totalUsers,
          sub: `${stats.verifiedUsers} verificados`,
          color: "text-blue-700",
          bg: "bg-blue-100",
        },
        {
          icon: IdCard,
          label: "KYC pendientes",
          value: stats.pendingKyc,
          sub: "En espera de revisión",
          color: "text-amber-700",
          bg: "bg-amber-100",
        },
        {
          icon: Files,
          label: "Contratos totales",
          value: stats.totalContracts,
          sub: `${stats.signedContracts} firmados`,
          color: "text-zinc-300",
          bg: "bg-zinc-800",
        },
        {
          icon: CheckCircle2,
          label: "Firmados",
          value: stats.signedContracts,
          sub: `${stats.pendingContracts} pendientes`,
          color: "text-emerald-400",
          bg: "bg-emerald-900/30",
        },
        {
          icon: XCircle,
          label: "Rechazados",
          value: stats.rejectedContracts,
          sub: "Contratos rechazados",
          color: "text-red-400",
          bg: "bg-red-900/30",
        },
        {
          icon: FileSignature,
          label: "Tasa de firma",
          value: stats.totalContracts
            ? `${Math.round((stats.signedContracts / stats.totalContracts) * 100)}%`
            : "—",
          sub: "Documentos completados",
          color: "text-zinc-400",
          bg: "bg-zinc-800",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
          Panel de administración
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Resumen general</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Métricas en tiempo real del sistema de firma electrónica.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array(6)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
              ))
          : cards.map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs font-semibold text-zinc-400">{label}</p>
                  <p className="text-[11px] text-zinc-600">{sub}</p>
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
            className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 hover:bg-zinc-800/80 transition"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800">
              <Icon size={18} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-zinc-500">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
