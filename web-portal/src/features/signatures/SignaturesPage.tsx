import { useState } from "react";
import { AlertCircle, Eye, FileSignature, PenLine } from "lucide-react";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { Card } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { signatureRequestsApi } from "./services/signatureRequests.api";
import { PublicSigningPage } from "./PublicSigningPage";

function getRequestDetails(request: any) {
  const isExpired = new Date(request.expires_at) < new Date();
  
  if (request.status === "SIGNED" && request.signed_at) {
    return `Firmado el ${new Date(request.signed_at).toLocaleString()}`;
  }
  if (request.status === "REJECTED") {
    return `Rechazado`;
  }
  if (isExpired) {
    return `Expiró el ${new Date(request.expires_at).toLocaleDateString()}`;
  }
  
  const expiryText = `vence el ${new Date(request.expires_at).toLocaleDateString()}`;
  if (request.status === "VIEWED" && request.viewed_at) {
    return `Visto el ${new Date(request.viewed_at).toLocaleString()} · ${expiryText}`;
  }
  
  return `Recibido el ${new Date(request.sent_at).toLocaleString()} · ${expiryText}`;
}

export function SignaturesPage() {
  const { data, loading, error, reload } = useApiResource(signatureRequestsApi.listMine, []);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (activeId) {
    return (
      <PublicSigningPage
        id={activeId}
        onComplete={() => {
          setActiveId(null);
          void reload();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Flujo de firma"
        title="Solicitudes de firma"
        description="Listado de documentos que requieren tu firma digital y conformidad legal."
      />

      {loading ? <p className="text-sm text-zinc-500">Cargando solicitudes...</p> : null}
      {error ? <EmptyState icon={AlertCircle} title="No se pudieron cargar solicitudes" description={error} /> : null}
      {!loading && !error && !data?.length ? (
        <EmptyState icon={FileSignature} title="Sin solicitudes asignadas" description="Cuando un documento requiera tu firma, va a aparecer en esta lista." />
      ) : null}

      <div className="grid gap-4">
        {data?.map((request) => {
          const isExpired = new Date(request.expires_at) < new Date();
          const canSign = request.status !== "SIGNED" && request.status !== "REJECTED" && !isExpired;

          return (
            <Card key={request.id} className="p-5 hover-lift">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-zinc-950">{request.document_title}</p>
                  <p className="mt-1 text-xs text-zinc-400 font-medium">{getRequestDetails(request)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={isExpired && request.status !== "SIGNED" && request.status !== "REJECTED" ? "EXPIRED" : request.status} />
                  <Button variant="secondary" type="button" onClick={() => setActiveId(request.id)} className="h-9 text-xs px-3 rounded-lg"><Eye size={14} /> Ver</Button>
                  {canSign && (
                    <Button variant="secondary" type="button" onClick={() => setActiveId(request.id)} className="h-9 text-xs px-3 rounded-lg"><PenLine size={14} /> Firmar</Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
