import { AlertCircle, KeyRound, Plus } from "lucide-react";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { Card } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { certificatesApi } from "./services/certificates.api";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "sin vencimiento";
}

export function CertificatesPage() {
  const { data, loading, error } = useApiResource(certificatesApi.list, []);

  return (
    <>
      <PageHeader
        eyebrow="Identidad digital"
        title="Mis certificados"
        description="Metadata de certificados. Las claves privadas nunca deben almacenarse en texto plano."
        action={<Button type="button"><Plus size={16} /> Asociar certificado</Button>}
      />

      {loading ? <p className="text-sm text-zinc-500">Cargando certificados...</p> : null}
      {error ? <EmptyState icon={AlertCircle} title="No se pudieron cargar certificados" description={error} /> : null}
      {!loading && !error && !data?.length ? (
        <EmptyState icon={KeyRound} title="Sin certificados" description="Los certificados asociados a tu usuario van a aparecer acá." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((certificate) => (
          <Card key={certificate.id} className="p-5 hover-lift">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200/50">
                <KeyRound size={20} />
              </div>
              <Badge status={certificate.status} />
            </div>
            <h2 className="mt-5 font-bold text-zinc-950">{certificate.label}</h2>
            <p className="mt-2 text-sm text-zinc-500">{certificate.type} · {certificate.issuer ?? "sin emisor"}</p>
            <p className="mt-4 text-xs font-semibold text-zinc-400">Vence: {formatDate(certificate.valid_to)}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
