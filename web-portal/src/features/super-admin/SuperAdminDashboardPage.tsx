import { Building2, Users, CheckCircle, Clock } from "lucide-react";

const STATS = [
  { label: "Organizaciones activas", value: "—", icon: Building2, color: "text-violet-600 bg-violet-50" },
  { label: "Usuarios totales",       value: "—", icon: Users,     color: "text-blue-600 bg-blue-50" },
  { label: "KYC verificados",        value: "—", icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
  { label: "KYC pendientes",         value: "—", icon: Clock,     color: "text-amber-600 bg-amber-50" },
];

export function SuperAdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel general</h1>
        <p className="mt-1 text-sm text-zinc-400">Resumen de todas las organizaciones en la plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className={`mb-3 inline-grid h-10 w-10 place-items-center rounded-xl ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="mt-1 text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm font-semibold text-zinc-400">
          Los datos se cargarán cuando la base de datos multitenant esté lista (B1).
        </p>
      </div>
    </div>
  );
}
