import { FileClock, Hash, Monitor, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAllAuditEvents as getAuditEvents } from "../../shared/services/audit.service";
import type { AuditEvent } from "../../shared/types/signing";

const ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: "Usuario registrado",
  IDENTITY_VERIFIED: "Identidad verificada",
  IDENTITY_REJECTED: "Identidad rechazada",
  DOCUMENT_SENT: "Documento enviado",
  DOCUMENT_VIEWED: "Documento visto",
  DOCUMENT_ACCEPTED: "Conformidad aceptada",
  DOCUMENT_SIGNED: "Documento firmado",
  DOCUMENT_COMPLETED: "Proceso completado",
  DOCUMENT_REJECTED: "Documento rechazado",
};

function actionColor(action: string) {
  if (action.includes("SIGNED") || action.includes("VERIFIED") || action.includes("COMPLETED") || action.includes("ACCEPTED"))
    return "text-emerald-700 bg-emerald-50/60 border-emerald-200/60";
  if (action.includes("REJECTED"))
    return "text-rose-700 bg-rose-50/60 border-rose-200/60";
  if (action.includes("SENT") || action.includes("VIEWED") || action.includes("SUBMITTED"))
    return "text-amber-700 bg-amber-50/60 border-amber-200/60";
  return "text-zinc-550 bg-zinc-50 border-zinc-200/60";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAuditEvents().then((e) => {
      setEvents(e);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        (e.ipAddress ?? "").includes(q)
    );
  }, [events, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-100 pb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Admin</p>
        <h1 className="mt-1 text-3xl font-black text-zinc-955 tracking-tight">Auditoría del sistema</h1>
        <p className="mt-1.5 text-sm text-zinc-500 font-medium">Log completo e inmutable de todas las acciones del sistema.</p>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm focus-within:border-zinc-955 focus-within:ring-1 focus-within:ring-zinc-955 transition-all duration-300">
        <Search size={15} className="shrink-0 text-zinc-400" />
        <input
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          placeholder="Filtrar por acción, entidad o IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} type="button" className="text-zinc-400 hover:text-zinc-650 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Audit Log list */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(null).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 m-5 rounded-2xl bg-zinc-50/50">
          <FileClock size={32} className="text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-500">Sin eventos para mostrar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...filtered].reverse().map((event) => (
            <div
              key={event.id}
              className="group rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm hover:shadow-md hover:border-zinc-350 transition-all duration-300 space-y-3.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${actionColor(event.action)}`}>
                    {ACTION_LABELS[event.action] ?? event.action}
                  </span>
                </div>
                <p className="shrink-0 text-[11px] text-zinc-400 font-bold tracking-tight">
                  {formatDate(event.createdAt)}
                </p>
              </div>

              <div className="grid gap-2.5 text-xs text-zinc-500 sm:grid-cols-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-zinc-400 font-bold tracking-wide text-[10px] uppercase">Entidad:</span>
                  <span className="font-mono text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-md px-2 py-0.5 text-[11px] truncate">
                    {event.entityType} <span className="text-zinc-300 font-sans">/</span> {event.entityId ?? "—"}
                  </span>
                </div>
                {event.ipAddress && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-zinc-400 font-bold tracking-wide text-[10px] uppercase flex items-center gap-1">
                      <Monitor size={10} className="text-zinc-400" /> IP:
                    </span>
                    <span className="font-mono text-zinc-700 bg-zinc-50 border border-zinc-100 rounded-md px-2 py-0.5 text-[11px]">
                      {event.ipAddress}
                    </span>
                  </div>
                )}
                {event.documentHash && (
                  <div className="flex items-center gap-1.5 sm:col-span-2 min-w-0">
                    <span className="text-zinc-400 font-bold tracking-wide text-[10px] uppercase flex items-center gap-1">
                      <Hash size={10} className="text-zinc-400" /> Hash:
                    </span>
                    <span className="font-mono text-zinc-550 truncate text-[11px]">
                      {event.documentHash}
                    </span>
                  </div>
                )}
              </div>

              {Object.keys(event.metadata).length > 0 && (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/40 p-4 font-mono text-[11px] text-zinc-650 leading-relaxed overflow-x-auto shadow-inner">
                  <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
