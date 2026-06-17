import { FileClock, Hash, Monitor } from "lucide-react";
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
  if (action.includes("SIGNED") || action.includes("VERIFIED") || action.includes("COMPLETED"))
    return "text-emerald-400 bg-emerald-900/20 border-emerald-800";
  if (action.includes("REJECTED"))
    return "text-red-400 bg-red-900/20 border-red-800";
  if (action.includes("SENT") || action.includes("VIEWED"))
    return "text-amber-400 bg-amber-900/20 border-amber-800";
  return "text-zinc-400 bg-zinc-800 border-zinc-700";
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
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Auditoría del sistema</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Log completo e inmutable de todas las acciones del sistema.
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 focus-within:border-zinc-600">
        <FileClock size={15} className="shrink-0 text-zinc-600" />
        <input
          className="w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
          placeholder="Filtrar por acción, entidad o IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(null).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FileClock size={32} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">Sin eventos para mostrar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...filtered].reverse().map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${actionColor(event.action)}`}>
                    {ACTION_LABELS[event.action] ?? event.action}
                  </span>
                </div>
                <p className="shrink-0 text-[11px] text-zinc-600 font-mono">
                  {formatDate(event.createdAt)}
                </p>
              </div>

              <div className="grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-700">Entidad:</span>
                  <span className="font-mono text-zinc-400">
                    {event.entityType} / {event.entityId ?? "—"}
                  </span>
                </div>
                {event.ipAddress && (
                  <div className="flex items-center gap-1.5">
                    <Monitor size={11} className="text-zinc-700" />
                    <span className="font-mono text-zinc-400">{event.ipAddress}</span>
                  </div>
                )}
                {event.documentHash && (
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <Hash size={11} className="text-zinc-700" />
                    <span className="font-mono text-zinc-500 truncate">
                      {event.documentHash.slice(0, 32)}...
                    </span>
                  </div>
                )}
              </div>

              {Object.keys(event.metadata).length > 0 && (
                <div className="rounded-lg bg-zinc-800/50 px-3 py-2 font-mono text-[11px] text-zinc-500">
                  {JSON.stringify(event.metadata)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
