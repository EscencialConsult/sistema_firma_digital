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
import type { KycPersonalData, KycVerification } from "../../shared/types/kyc";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(status: string) {
  switch (status) {
    case "VERIFIED":  return "text-emerald-400 bg-emerald-900/30 border-emerald-800";
    case "IN_REVIEW": return "text-amber-400 bg-amber-900/30 border-amber-800";
    case "REJECTED":  return "text-red-400 bg-red-900/30 border-red-800";
    default:          return "text-zinc-400 bg-zinc-800 border-zinc-700";
  }
}

// ─── DNI Card (front) ────────────────────────────────────────────────────────

function DniCardFront({ pd }: { pd: KycPersonalData }) {
  const lastName  = pd.fullName.split(" ").slice(-1)[0]?.toUpperCase() ?? "";
  const firstName = pd.fullName.split(" ").slice(0, -1).join(" ").toUpperCase();

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#1e40af 40%,#1d4ed8 100%)", minHeight: 158 }}
    >
      {/* Argentine flag stripe */}
      <div className="absolute left-0 top-0 h-full w-2 flex flex-col">
        <div className="flex-1 bg-sky-400" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-sky-400" />
      </div>

      {/* Header */}
      <div className="pl-5 pr-4 pt-3">
        <p className="text-[8px] font-bold tracking-[0.18em] text-white/70 uppercase">República Argentina</p>
        <p className="text-[7px] text-white/40 tracking-wider">Documento Nacional de Identidad</p>
      </div>

      {/* Content */}
      <div className="flex gap-3 px-5 pb-3 pt-2">
        {/* Photo */}
        <div className="shrink-0 overflow-hidden rounded-lg border border-white/20" style={{ width: 52, height: 68 }}>
          <img
            src={`https://i.pravatar.cc/52?u=${pd.documentNumber}-front`}
            alt="Foto"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Data */}
        <div className="flex-1 space-y-1">
          <div>
            <p className="text-[6px] tracking-widest text-white/40 uppercase">Apellido</p>
            <p className="text-[11px] font-black leading-tight text-white">{lastName}</p>
          </div>
          <div>
            <p className="text-[6px] tracking-widest text-white/40 uppercase">Nombre/s</p>
            <p className="text-[10px] font-bold leading-tight text-white">{firstName}</p>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <div>
              <p className="text-[6px] tracking-widest text-white/40 uppercase">Nac.</p>
              <p className="text-[8px] font-semibold text-white">{pd.birthDate}</p>
            </div>
            <div>
              <p className="text-[6px] tracking-widest text-white/40 uppercase">D.N.I.</p>
              <p className="text-[10px] font-black text-amber-300">{pd.documentNumber}</p>
            </div>
          </div>
          <div>
            <p className="text-[6px] tracking-widest text-white/40 uppercase">CUIL / CUIT</p>
            <p className="text-[8px] font-semibold text-white/90">{pd.cuilCuit}</p>
          </div>
        </div>
      </div>

      {/* MRZ */}
      <div className="bg-black/20 px-5 py-1.5">
        <p className="truncate font-mono text-[6.5px] tracking-[0.12em] text-white/25">
          IDARG{pd.documentNumber.padStart(8, "0")}{"<".repeat(12)}
        </p>
      </div>
    </div>
  );
}

// ─── DNI Card (back) ─────────────────────────────────────────────────────────

function DniCardBack({ pd }: { pd: KycPersonalData }) {
  const bars = [0,2,3,5,8,9,11,14,16,17,19,22,25,26,28,31,33,36,38,39];

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#1e40af 40%,#1d4ed8 100%)", minHeight: 158 }}
    >
      {/* Left stripe */}
      <div className="absolute left-0 top-0 h-full w-2 flex flex-col">
        <div className="flex-1 bg-sky-400" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-sky-400" />
      </div>

      {/* Magnetic stripe */}
      <div className="bg-black/70 h-9 w-full" />

      {/* Data */}
      <div className="space-y-2 pl-5 pr-4 pt-3 pb-3">
        <div>
          <p className="text-[6px] tracking-widest text-white/40 uppercase">Domicilio</p>
          <p className="text-[10px] font-semibold text-white">{pd.address}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[6px] tracking-widest text-white/40 uppercase">Ciudad</p>
            <p className="text-[9px] font-semibold text-white">{pd.city}</p>
          </div>
          <div>
            <p className="text-[6px] tracking-widest text-white/40 uppercase">Provincia</p>
            <p className="text-[9px] font-semibold text-white">{pd.province}</p>
          </div>
        </div>
      </div>

      {/* Barcode */}
      <div className="px-5 pb-3">
        <div className="flex h-7 gap-px">
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ background: bars.includes(i) ? "rgba(255,255,255,0.8)" : "transparent" }}
            />
          ))}
        </div>
        <p className="mt-1 text-center font-mono text-[7px] tracking-widest text-white/30">
          {pd.documentNumber}
        </p>
      </div>
    </div>
  );
}

// ─── Selfie Card ─────────────────────────────────────────────────────────────

function SelfieCard({ userId }: { userId: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl bg-zinc-800" style={{ minHeight: 158 }}>
      <img
        src={`https://i.pravatar.cc/300?u=${userId}`}
        alt="Selfie de verificación"
        className="h-full w-full object-cover"
        style={{ minHeight: 158 }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <p className="text-[8px] font-bold tracking-widest text-white/70 uppercase">Selfie · Verificación</p>
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

  const pd = verification.personalData;
  const hasFront = verification.documents.some((d) => d.type === "DOCUMENT_FRONT");
  const hasBack  = verification.documents.some((d) => d.type === "DOCUMENT_BACK");
  const hasSelfie = verification.documents.some((d) => d.type === "SELFIE");

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-800/40 transition"
        type="button"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-800">
            <IdCard size={16} className="text-zinc-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-100 truncate">{pd?.fullName ?? "Sin nombre"}</p>
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
        <div className="border-t border-zinc-800 px-5 py-5 space-y-6">

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
                  <p className="font-medium text-zinc-300">{value}</p>
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
              {pd && hasFront && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">DNI — Frente</p>
                  <DniCardFront pd={pd} />
                </div>
              )}
              {pd && hasBack && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">DNI — Dorso</p>
                  <DniCardBack pd={pd} />
                </div>
              )}
              {hasSelfie && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Selfie</p>
                  <SelfieCard userId={verification.userId} />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {verification.status === "IN_REVIEW" && (
            <div className="space-y-3">
              {rejectMode ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
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
            <div className="rounded-xl border border-red-900 bg-red-900/20 p-4">
              <p className="text-xs font-semibold text-red-400 mb-1">Motivo del rechazo:</p>
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
        <h1 className="mt-1 text-2xl font-bold text-white">Verificaciones KYC</h1>
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
                ? "border-zinc-400 bg-zinc-700 text-white"
                : "border-zinc-700 bg-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(2).fill(null).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-800" />
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
