import {
  CheckCircle2,
  Clock,
  FileSignature,
  FileX,
  PenLine,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { getMySigningRequests } from "../../shared/services/signing.service";
import type { SigningRequest } from "../../shared/types/signing";

type Filter = "all" | "PENDING" | "SIGNED" | "REJECTED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",      label: "Todos" },
  { key: "PENDING",  label: "Pendientes" },
  { key: "SIGNED",   label: "Firmados" },
  { key: "REJECTED", label: "Rechazados" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function isExpired(request: SigningRequest) {
  return new Date(request.expiresAt) < new Date() && request.status !== "SIGNED" && request.status !== "REJECTED";
}

function StatusIcon({ request }: { request: SigningRequest }) {
  if (request.status === "SIGNED")   return <CheckCircle2 size={18} className="text-emerald-500" />;
  if (request.status === "REJECTED") return <XCircle      size={18} className="text-rose-400" />;
  if (isExpired(request))            return <FileX        size={18} className="text-zinc-300" />;
  return <Clock size={18} className="text-amber-400" />;
}

export function DocumentsPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [requests, setRequests]   = useState<SigningRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState<Filter>("all");

  useEffect(() => {
    if (!user?.email) return;
    getMySigningRequests(user.email)
      .then(setRequests)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar documentos"))
      .finally(() => setLoading(false));
  }, [user?.email]);

  const filtered = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  const pending = requests.filter((r) =>
    r.status !== "SIGNED" && r.status !== "REJECTED" && !isExpired(r)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Mis documentos"
        description="Contratos y documentos asignados para tu firma. El admin los genera desde el panel de contratos."
      />

      {/* Stats pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm">
          <span className="font-bold text-zinc-950">{requests.length}</span>
          <span className="text-zinc-400">total</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm">
          <span className="font-bold text-amber-700">{pending}</span>
          <span className="text-amber-600">pendientes</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm">
          <span className="font-bold text-emerald-700">
            {requests.filter((r) => r.status === "SIGNED").length}
          </span>
          <span className="text-emerald-600">firmados</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1.5 opacity-60">
                {requests.filter((r) => r.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="py-12 text-center text-sm text-zinc-400">Cargando documentos...</div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={FileSignature}
          title={filter === "all" ? "Sin documentos asignados" : `Sin documentos ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()}`}
          description={
            filter === "all"
              ? "Cuando el admin te asigne un contrato para firmar, va a aparecer acá."
              : "Probá con otro filtro."
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((request) => {
            const expired = isExpired(request);
            const canSign = request.status !== "SIGNED" && request.status !== "REJECTED" && !expired;

            return (
              <div
                key={request.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  {/* Left: icon + info */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon request={request} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-950 truncate">{request.documentTitle}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span>Recibido {formatDate(request.sentAt)}</span>
                        {!expired && request.status === "PENDING" && (
                          <span className="text-amber-600 font-medium">
                            Vence {formatDate(request.expiresAt)}
                          </span>
                        )}
                        {expired && (
                          <span className="text-rose-500 font-medium">Expirado</span>
                        )}
                        {request.status === "SIGNED" && (
                          <span className="text-emerald-600 font-medium">Firmado</span>
                        )}
                      </div>
                      {request.sha256Hash && (
                        <p className="mt-1 font-mono text-[10px] text-zinc-300 truncate max-w-[260px]">
                          SHA-256 {request.sha256Hash.slice(0, 24)}…
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: badge + action */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge status={expired ? "EXPIRED" : request.status} />
                    {canSign && (
                      <Button
                        onClick={() => navigate(`/signing/${request.id}`)}
                        className="h-9 px-4 text-xs"
                      >
                        <PenLine size={13} /> Firmar
                      </Button>
                    )}
                    {request.status === "SIGNED" && (
                      <Button
                        variant="secondary"
                        onClick={() => navigate(`/signing/${request.id}`)}
                        className="h-9 px-4 text-xs"
                      >
                        Ver firma
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
