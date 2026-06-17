import { AlertCircle, CheckCircle2, Clock, FileSignature, PenLine, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { getMySigningRequests } from "../../shared/services/signing.service";
import type { SigningRequest } from "../../shared/types/signing";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function isExpired(r: SigningRequest) {
  return new Date(r.expiresAt) < new Date() && r.status !== "SIGNED" && r.status !== "REJECTED";
}

function getStatusDetail(r: SigningRequest): string {
  if (r.status === "SIGNED")   return `Firmado el ${formatDate(r.sentAt)}`;
  if (r.status === "REJECTED") return "Rechazado";
  if (isExpired(r))            return `Expiró el ${formatDate(r.expiresAt)}`;
  return `Recibido el ${formatDate(r.sentAt)} · vence el ${new Date(r.expiresAt).toLocaleDateString("es-AR")}`;
}

function StatusIcon({ r }: { r: SigningRequest }) {
  if (r.status === "SIGNED")   return <CheckCircle2 size={16} className="text-emerald-500" />;
  if (r.status === "REJECTED") return <XCircle      size={16} className="text-rose-400" />;
  if (isExpired(r))            return <AlertCircle  size={16} className="text-zinc-300" />;
  return <Clock size={16} className="text-amber-400" />;
}

export function SignaturesPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [requests, setRequests] = useState<SigningRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    getMySigningRequests(user.email)
      .then(setRequests)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar solicitudes"))
      .finally(() => setLoading(false));
  }, [user?.email]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Flujo de firma"
        title="Solicitudes de firma"
        description="Documentos que requieren tu firma digital y conformidad legal."
      />

      {loading && (
        <p className="text-sm text-zinc-500">Cargando solicitudes...</p>
      )}

      {error && (
        <EmptyState icon={AlertCircle} title="Error al cargar" description={error} />
      )}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          icon={FileSignature}
          title="Sin solicitudes asignadas"
          description="Cuando un documento requiera tu firma, va a aparecer acá."
        />
      )}

      <div className="grid gap-4">
        {requests.map((r) => {
          const expired = isExpired(r);
          const canSign = r.status !== "SIGNED" && r.status !== "REJECTED" && !expired;

          return (
            <div
              key={r.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <StatusIcon r={r} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-950 truncate">{r.documentTitle}</p>
                    <p className="mt-1 text-xs text-zinc-400">{getStatusDetail(r)}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge status={expired ? "EXPIRED" : r.status} />
                  {canSign ? (
                    <Button
                      onClick={() => navigate(`/signing/${r.id}`)}
                      className="h-9 px-4 text-xs"
                    >
                      <PenLine size={13} /> Firmar ahora
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/signing/${r.id}`)}
                      className="h-9 px-4 text-xs"
                    >
                      Ver detalles
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
