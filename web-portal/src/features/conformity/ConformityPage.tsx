import { AlertCircle, ClipboardCheck, Files } from "lucide-react";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { conformityApi } from "./services/conformity.api";

function shortHash(value?: string) {
  return value ? value.slice(0, 16) : "sin hash";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "sin fecha";
}

export function ConformityPage() {
  const { data, loading, error } = useApiResource(conformityApi.listMine, []);

  return (
    <>
      <PageHeader
        eyebrow="Aceptación expresa"
        title="Declaración de conformidad"
        description="Historial y configuración de conformidades prestadas para la firma digital de documentos."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        {/* Conformity list */}
        <Card>
          <CardHeader title="Conformidades registradas" subtitle="Historial de aceptaciones explícitas firmadas en el sistema." />
          
          {loading ? <p className="p-5 text-sm text-slate-500">Cargando conformidades...</p> : null}
          {error ? <div className="p-5"><EmptyState icon={AlertCircle} title="No se pudieron cargar conformidades" description={error} /></div> : null}
          {!loading && !error && !data?.length ? (
            <div className="p-5">
              <EmptyState icon={Files} title="Sin registros" description="Aquí aparecerán las declaraciones de conformidad cuando firmes documentos." />
            </div>
          ) : null}

          {data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/30 text-xs font-semibold text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Documento</th>
                    <th className="px-5 py-3">Declaración</th>
                    <th className="px-5 py-3">IP Origen</th>
                    <th className="px-5 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/70">
                  {data.map((record) => (
                    <tr key={record.id} className="group hover:bg-zinc-50/30 transition duration-150">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-zinc-950">{record.document_title}</p>
                        <p className="mt-1 text-xs text-zinc-400">Ver. {record.document_version} · Hash {shortHash(record.document_hash)}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-600 max-w-[240px] truncate" title={record.acceptance_text}>
                        {record.acceptance_text}
                      </td>
                      <td className="px-5 py-4 text-zinc-500 font-mono text-xs">{record.ip_address || "N/D"}</td>
                      <td className="px-5 py-4 text-zinc-500">{formatDate(record.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        {/* Sidebar info */}
        <Card>
          <CardHeader title="Texto legal recomendado" subtitle="Texto estipulado para la conformidad." />
          <div className="space-y-4 p-5 text-sm">
            <p className="text-xs text-zinc-500 leading-relaxed">
              El siguiente texto es la declaración legal requerida antes de aplicar cualquier firma visual o criptográfica:
            </p>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-4 font-medium text-xs text-zinc-700 leading-relaxed italic">
              "Declaro haber leído y aceptado el contenido del documento, prestando conformidad de manera libre, voluntaria e informada."
            </div>
            <div className="rounded-xl bg-emerald-50/40 border border-emerald-100/60 p-4 text-xs text-emerald-900 leading-relaxed">
              <strong>Trazabilidad Legal:</strong> Al hacer clic en Aceptar Conformidad, se registra de manera inmutable el hash SHA-256 del documento original, versión, IP, fecha y hora, estableciendo un nexo probatorio vinculante.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

