import { CheckCircle2, Clock3, FileSignature, Files, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { getMySigningRequests } from "../../shared/services/signing.service";
import type { SigningRequest } from "../../shared/types/signing";

function statusMeta(status: SigningRequest["status"]) {
  switch (status) {
    case "SIGNED":
      return { label: "Firmado",    className: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 };
    case "CONFORMITY_ACCEPTED":
      return { label: "En proceso", className: "text-blue-700 bg-blue-50 border-blue-200",           icon: Clock3 };
    case "PENDING":
    case "VIEWED":
      return { label: "Pendiente",  className: "text-amber-700 bg-amber-50 border-amber-200",        icon: Clock3 };
    case "REJECTED":
      return { label: "Rechazado",  className: "text-red-700 bg-red-50 border-red-200",              icon: XCircle };
    default:
      return { label: status,       className: "text-zinc-500 bg-zinc-50 border-zinc-200",           icon: Files };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function ContractsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SigningRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "signed" | "rejected">("all");

  useEffect(() => {
    if (!user?.email) return;
    getMySigningRequests(user.email)
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "pending":  return requests.filter((r) => ["PENDING","VIEWED","CONFORMITY_ACCEPTED"].includes(r.status));
      case "signed":   return requests.filter((r) => r.status === "SIGNED");
      case "rejected": return requests.filter((r) => r.status === "REJECTED");
      default:         return requests;
    }
  }, [requests, filter]);

  const pendingCount = requests.filter((r) => r.status === "PENDING" || r.status === "VIEWED").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Documentos</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-950">Mis contratos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Contratos asignados a tu cuenta para revisión y firma.
        </p>
      </div>

      {/* Alerta de pendientes */}
      {!loading && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <Clock3 size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {pendingCount === 1
                ? "Tenés 1 contrato pendiente de firma"
                : `Tenés ${pendingCount} contratos pendientes de firma`}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Hacé click en "Firmar" para completar el proceso.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all",      label: "Todos" },
          { key: "pending",  label: "Pendientes" },
          { key: "signed",   label: "Firmados" },
          { key: "rejected", label: "Rechazados" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            type="button"
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              filter === key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
            }`}
          >
            {label}
            {key === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">Cargando contratos...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center px-5">
            <Files size={36} className="text-zinc-300 mb-3" />
            <p className="text-sm font-semibold text-zinc-500">
              {filter === "all" ? "Sin contratos asignados todavía" : "Sin contratos en este estado"}
            </p>
            {filter === "all" && (
              <p className="text-xs text-zinc-400 mt-1">
                Cuando te asignen un contrato para firmar, va a aparecer acá.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((r) => {
              const { label, className, icon: StatusIcon } = statusMeta(r.status);
              const isPending = r.status === "PENDING" || r.status === "VIEWED" || r.status === "CONFORMITY_ACCEPTED";
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 px-5 py-5 hover:bg-zinc-50/60 transition sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100">
                      <FileSignature size={17} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-950 truncate">{r.documentTitle}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Vence {formatDate(r.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}>
                      <StatusIcon size={12} />
                      {label}
                    </span>
                    {isPending && (
                      <Link to={`/signing/${r.id}`}>
                        <Button className="h-8 px-4 text-xs">
                          <FileSignature size={13} /> Firmar
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
