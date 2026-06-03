import { AlertCircle, CheckCircle2, Clock3, FileSignature, Files } from "lucide-react";
import { Badge } from "../../shared/components/ui/Badge";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { StatCard } from "../../shared/components/ui/StatCard";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { dashboardApi } from "./services/dashboard.api";

function shortHash(value?: string) {
  return value ? value.slice(0, 12) : "sin hash";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "sin fecha";
}

export function DashboardPage() {
  const { data, loading, error } = useApiResource(dashboardApi.summary, []);

  return (
    <>
      <PageHeader
        eyebrow="Operacion"
        title="Centro de firma y conformidad"
        description="Vista ejecutiva del estado documental, solicitudes activas y trazabilidad reciente."
      />

      {error ? <EmptyState icon={AlertCircle} title="No se pudo cargar el dashboard" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Files} label="Documentos" value={loading ? "..." : String(data?.stats.documents ?? 0)} detail="Persistidos en PostgreSQL" />
        <StatCard icon={FileSignature} label="Pendientes de firma" value={loading ? "..." : String(data?.stats.pendingSignatures ?? 0)} detail="Asignados a tu email" />
        <StatCard icon={CheckCircle2} label="Completados" value={loading ? "..." : String(data?.stats.completedDocuments ?? 0)} detail="Con flujo finalizado" />
        <StatCard icon={Clock3} label="Rechazados" value={loading ? "..." : String(data?.stats.rejectedDocuments ?? 0)} detail="Con evidencia registrada" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Documentos recientes" subtitle="Estado operativo de tus últimos documentos." />
          {loading ? <p className="p-5 text-sm text-zinc-500">Cargando documentos...</p> : null}
          {!loading && !data?.recentDocuments.length ? (
            <div className="p-5">
              <EmptyState icon={Files} title="Todavía no hay documentos" description="Cuando subas PDFs, van a aparecer acá con su estado real." />
            </div>
          ) : null}
          <div className="divide-y divide-zinc-100">
            {data?.recentDocuments.map((document) => (
              <div key={String(document.id)} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between hover:bg-zinc-50/30 transition duration-150">
                <div>
                  <p className="font-semibold text-zinc-950">{String(document.title)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Hash {shortHash(document.sha256_hash)} · {document.signers ?? 0} firmantes · {formatDate(document.updated_at)}</p>
                </div>
                <Badge status={String(document.status)} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Auditoría reciente" subtitle="Eventos reales asociados a tu actividad." />
          {loading ? <p className="p-5 text-sm text-zinc-500">Cargando auditoría...</p> : null}
          {!loading && !data?.recentActivity.length ? (
            <div className="p-5">
              <EmptyState icon={Clock3} title="Sin eventos aún" description="La actividad documental va a aparecer cuando operes documentos o solicitudes." />
            </div>
          ) : null}
          <div className="space-y-5 p-5">
            {data?.recentActivity.map((event) => (
              <div key={String(event.id)} className="relative border-l border-zinc-100 pl-5 pb-1 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-900 border-2 border-white ring-1 ring-zinc-200/50" />
                <p className="text-[10px] font-bold tracking-wide uppercase text-zinc-400">{formatDate(event.created_at)} · {String(event.action)}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-950">{String(event.entity_type)}</p>
                <p className="mt-0.5 text-xs text-zinc-500">Entidad {String(event.entity_id ?? "sin referencia")}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
