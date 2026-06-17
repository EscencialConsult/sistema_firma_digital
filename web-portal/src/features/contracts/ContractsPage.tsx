import { CheckCircle2, Clock3, FileSignature, Files, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyContracts } from "../../shared/services/contracts.service";
import type { Contract, ContractStatus } from "../../shared/types/contract";

function statusMeta(status: ContractStatus) {
  switch (status) {
    case "SIGNED":
    case "COMPLETED":
      return {
        label: "Firmado",
        className: "text-emerald-700 bg-emerald-50 border-emerald-200",
        icon: CheckCircle2,
      };
    case "SENT":
    case "VIEWED":
      return {
        label: "Pendiente",
        className: "text-amber-700 bg-amber-50 border-amber-200",
        icon: Clock3,
      };
    case "CONFORMITY_ACCEPTED":
      return {
        label: "Conformidad aceptada",
        className: "text-blue-700 bg-blue-50 border-blue-200",
        icon: Clock3,
      };
    case "REJECTED":
      return {
        label: "Rechazado",
        className: "text-red-700 bg-red-50 border-red-200",
        icon: XCircle,
      };
    case "EXPIRED":
      return {
        label: "Vencido",
        className: "text-zinc-500 bg-zinc-50 border-zinc-200",
        icon: XCircle,
      };
    default:
      return {
        label: status,
        className: "text-zinc-600 bg-zinc-50 border-zinc-200",
        icon: Files,
      };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "signed" | "rejected">("all");

  useEffect(() => {
    getMyContracts().then((c) => {
      setContracts(c);
      setLoading(false);
    });
  }, []);

  const filtered = contracts.filter((c) => {
    if (filter === "pending")
      return ["SENT", "VIEWED", "CONFORMITY_ACCEPTED"].includes(c.status);
    if (filter === "signed") return ["SIGNED", "COMPLETED"].includes(c.status);
    if (filter === "rejected") return ["REJECTED", "EXPIRED"].includes(c.status);
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Documentos</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-950">Mis contratos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Todos los contratos enviados a tu cuenta para firma o revisión.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: "Todos" },
            { key: "pending", label: "Pendientes" },
            { key: "signed", label: "Firmados" },
            { key: "rejected", label: "Rechazados / Vencidos" },
          ] as const
        ).map(({ key, label }) => (
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
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">Cargando contratos...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Files size={36} className="text-zinc-300 mb-3" />
            <p className="text-sm font-semibold text-zinc-500">Sin contratos en este estado</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((c) => {
              const { label, className, icon: StatusIcon } = statusMeta(c.status);
              return (
                <Link
                  key={c.id}
                  to={`/contracts/${c.id}`}
                  className="flex flex-col gap-3 px-5 py-5 hover:bg-zinc-50/60 transition sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100">
                      <FileSignature size={17} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-950 truncate">{c.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">{c.description}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Actualizado {formatDate(c.updatedAt)} · v{c.versionNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}
                    >
                      <StatusIcon size={12} />
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
