import { AlertCircle, Clock3 } from "lucide-react";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { auditApi } from "./services/audit.api";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function AuditPage() {
  const { data, loading, error } = useApiResource(auditApi.mine, []);

  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title="Auditoria documental"
        description="Cada accion relevante genera una evidencia con fecha, entidad afectada y metadata."
      />
      <Card>
        <CardHeader title="Timeline de eventos" subtitle="Eventos persistidos en el backend para tu usuario y documentos." />
        <div className="p-5 space-y-0">
          {loading ? <p className="text-sm text-zinc-500">Cargando auditoría...</p> : null}
          {error ? <EmptyState icon={AlertCircle} title="No se pudo cargar la auditoría" description={error} /> : null}
          {!loading && !error && !data?.length ? (
            <EmptyState icon={Clock3} title="Sin eventos registrados" description="La auditoría se va a completar a medida que uses documentos, identidad y firmas." />
          ) : null}
          {data?.map((event) => (
            <div key={event.id} className="relative border-l border-zinc-100 pb-6 pl-5 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-zinc-900 border-2 border-white ring-1 ring-zinc-200/50" />
              <p className="text-[10px] font-bold tracking-wide uppercase text-zinc-400">{formatDate(event.created_at)} · {event.action}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">{event.entity_type}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Entidad {event.entity_id ?? "sin referencia"}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
