import { AlertCircle, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { getAllAuditEvents, getMyAuditEvents } from "../../shared/services/audit.service";
import { useAuth } from "../../app/providers/AuthProvider";
import type { AuditEvent } from "../../shared/types/signing";

const ACTION_LABELS: Record<string, string> = {
  DOCUMENT_SIGNED:      "Documento firmado",
  CONFORMITY_ACCEPTED:  "Conformidad aceptada",
  IDENTITY_VERIFIED:    "Identidad verificada",
  IDENTITY_REJECTED:    "Identidad rechazada",
  DOCUMENT_CREATED:     "Documento creado",
  USER_ROLE_CHANGED:    "Rol modificado",
  LOGIN:                "Inicio de sesión",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AuditPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [events,  setEvents]  = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const fetcher = isAdmin ? getAllAuditEvents() : getMyAuditEvents();
    fetcher
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title="Historial de actividad"
        description={isAdmin ? "Todos los eventos del sistema con fecha, entidad y metadata." : "Cada acción relevante genera una evidencia con fecha, entidad afectada y metadata."}
      />
      <Card>
        <CardHeader title="Timeline de eventos" subtitle={isAdmin ? "Todos los eventos registrados en Supabase." : "Eventos registrados en Supabase para tu usuario."} />
        <div className="p-5 space-y-0">
          {loading && <p className="text-sm text-zinc-500">Cargando...</p>}
          {error   && <EmptyState icon={AlertCircle} title="No se pudo cargar el historial" description={error} />}
          {!loading && !error && !events.length && (
            <EmptyState
              icon={Clock3}
              title="Sin eventos registrados"
              description="El historial se completa a medida que usás documentos, identidad y firmas."
            />
          )}
          {events.map((ev) => (
            <div key={ev.id} className="relative border-l border-zinc-100 pb-6 pl-5 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-zinc-900 border-2 border-white ring-1 ring-zinc-200/50" />
              <p className="text-[10px] font-bold tracking-wide uppercase text-zinc-400">
                {formatDate(ev.createdAt)} · {actionLabel(ev.action)}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-950 capitalize">
                {ev.entityType.replace(/_/g, " ")}
              </p>
              {ev.entityId && (
                <p className="mt-0.5 text-xs text-zinc-400 font-mono">{ev.entityId}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
