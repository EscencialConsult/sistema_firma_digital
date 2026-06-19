import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  IdCard,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import {
  approveVerification,
  listAllVerifications,
  rejectVerification,
} from "../../shared/services/kyc.service";
import type { KycVerification } from "../../shared/types/kyc";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(status: string) {
  switch (status) {
    case "VERIFIED":  return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "IN_REVIEW": return "text-amber-700 bg-amber-50 border-amber-200";
    case "REJECTED":  return "text-red-600 bg-red-900/30 border-red-200";
    default:          return "text-zinc-400 bg-zinc-50 border-zinc-200";
  }
}

// ─── Document image ───────────────────────────────────────────────────────────

function DocImage({ url, label }: { url?: string; label: string }) {
  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-600 text-xs" style={{ minHeight: 158 }}>
        Sin imagen
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-50" style={{ minHeight: 158 }}>
      <img
        src={url}
        alt={label}
        className="w-full h-full object-contain rounded-2xl"
        style={{ minHeight: 158, maxHeight: 260 }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <p className="text-[8px] font-bold tracking-widest text-zinc-900/70 uppercase">{label}</p>
      </div>
    </div>
  );
}

// ─── Verification Card ───────────────────────────────────────────────────────

function VerificationCard({
  verification,
  onApprove,
  onReject,
}: {
  verification: KycVerification;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await onApprove(verification.id);
    setLoading(false);
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setLoading(true);
    await onReject(verification.id, reason);
    setLoading(false);
    setRejectMode(false);
  }

  const pd        = verification.personalData;
  const frontDoc  = verification.documents.find((d) => d.type === "DOCUMENT_FRONT");
  const backDoc   = verification.documents.find((d) => d.type === "DOCUMENT_BACK");
  const selfieDoc = verification.documents.find((d) => d.type === "SELFIE");

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-50/40 transition"
        type="button"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-50">
            <IdCard size={16} className="text-zinc-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 truncate">{pd?.fullName ?? "Sin nombre"}</p>
            <p className="text-xs text-zinc-500">
              DNI {pd?.documentNumber ?? "—"} · Enviado {formatDate(verification.submittedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(verification.status)}`}>
            {verification.status === "IN_REVIEW" ? "En revisión" : verification.status === "REJECTED" ? "Rechazado" : verification.status}
          </span>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-200 px-5 py-5 space-y-6">

          {/* Personal data grid */}
          {pd && (
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              {([
                ["CUIL/CUIT", pd.cuilCuit],
                ["Fecha de nac.", pd.birthDate],
                ["Teléfono", pd.phone],
                ["Domicilio", pd.address],
                ["Ciudad", pd.city],
                ["Provincia", pd.province],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-zinc-600">{label}</p>
                  <p className="font-medium text-zinc-700">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Document images */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-600">
              Documentos presentados
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">DNI — Frente</p>
                <DocImage url={frontDoc?.previewUrl} label="DNI Frente" />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">DNI — Dorso</p>
                <DocImage url={backDoc?.previewUrl} label="DNI Dorso" />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Selfie</p>
                <DocImage url={selfieDoc?.previewUrl} label="Selfie · Verificación" />
              </div>
            </div>
          </div>

          {/* Actions */}
          {verification.status === "IN_REVIEW" && (
            <div className="space-y-3">
              {rejectMode ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
                    placeholder="Motivo del rechazo (visible para el usuario)..."
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={handleReject} disabled={!reason.trim() || loading} className="flex-1 h-10">
                      <XCircle size={14} />
                      {loading ? "Rechazando..." : "Confirmar rechazo"}
                    </Button>
                    <Button variant="secondary" onClick={() => setRejectMode(false)} className="h-10">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleApprove} disabled={loading} className="flex-1 h-10">
                    <CheckCircle2 size={14} />
                    {loading ? "Aprobando..." : "Aprobar verificación"}
                  </Button>
                  <Button variant="danger" onClick={() => setRejectMode(true)} disabled={loading} className="flex-1 h-10">
                    <XCircle size={14} />
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          )}

          {verification.status === "REJECTED" && verification.rejectionReason && (
            <div className="rounded-xl border border-red-900 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-600 mb-1">Motivo del rechazo:</p>
              <p className="text-sm text-red-300 leading-relaxed">{verification.rejectionReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminKycReviewPage() {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState<KycVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"IN_REVIEW" | "REJECTED" | "all">("IN_REVIEW");

  useEffect(() => {
    listAllVerifications().then((v) => { setVerifications(v); setLoading(false); });
  }, []);

  async function handleApprove(id: string) {
    await approveVerification(id, user?.id ?? "");
    setVerifications((prev) => prev.map((v) => v.id === id ? { ...v, status: "VERIFIED" as const } : v));
  }

  async function handleReject(id: string, reason: string) {
    await rejectVerification(id, user?.id ?? "", reason);
    setVerifications((prev) =>
      prev.map((v) => v.id === id ? { ...v, status: "REJECTED" as const, rejectionReason: reason } : v)
    );
  }

  const filtered = filter === "all" ? verifications : verifications.filter((v) => v.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Verificaciones KYC</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Revisá la documentación de identidad y aprobá o rechazá cada solicitud.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { key: "IN_REVIEW", label: "En revisión" },
          { key: "REJECTED",  label: "Rechazadas" },
          { key: "all",       label: "Todas" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            type="button"
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              filter === key
                ? "border-zinc-400 bg-zinc-700 text-zinc-900"
                : "border-zinc-200 bg-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(2).fill(null).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <IdCard size={36} className="text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">Sin verificaciones en este estado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((v) => (
            <VerificationCard key={v.id} verification={v} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}
    </div>
  );
}
