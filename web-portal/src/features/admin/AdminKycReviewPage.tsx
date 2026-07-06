import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  IdCard,
  XCircle,
  Eye,
  X,
  AlertCircle,
  Calendar,
  User,
  Smartphone,
  MapPin,
  FileText
} from "lucide-react";
import { useEffect, useState, ReactNode } from "react";
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
    case "VERIFIED":  return "text-emerald-700 bg-emerald-50 border-emerald-200/60";
    case "IN_REVIEW": return "text-amber-700 bg-amber-50 border-amber-200/60";
    case "REJECTED":  return "text-rose-700 bg-rose-50 border-rose-200/60";
    default:          return "text-zinc-500 bg-zinc-50 border-zinc-200/60";
  }
}

const STATUS_LABELS: Record<string, string> = {
  IN_REVIEW: "En revisión",
  REJECTED: "Rechazado",
  VERIFIED: "Aprobado",
};

// ─── Document image ───────────────────────────────────────────────────────────

function DocImage({ url, label, onZoom }: { url?: string; label: string; onZoom?: () => void }) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 border-dashed bg-zinc-50/50 text-zinc-400 text-xs p-8" style={{ minHeight: 180 }}>
        <IdCard className="h-6 w-6 text-zinc-300 mb-2" />
        Sin imagen
      </div>
    );
  }
  return (
    <div 
      onClick={onZoom}
      className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm transition-all duration-300 hover:border-zinc-400 hover:shadow-md" 
      style={{ minHeight: 180 }}
    >
      <img
        src={url}
        alt={label}
        className="w-full h-full object-contain rounded-xl opacity-90 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
        style={{ minHeight: 180, maxHeight: 260 }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full bg-white/95 text-zinc-900 shadow-md scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <Eye size={18} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
        <p className="text-[10px] font-semibold tracking-wider text-white uppercase">{label}</p>
      </div>
    </div>
  );
}

// ─── Lightbox Modal ──────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 transition-all duration-300"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800"
      >
        <img
          src={url}
          alt="Documento ampliado"
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full bg-black/60 p-2.5 text-white hover:bg-black/90 transition-all active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ─── Verification Card ───────────────────────────────────────────────────────

function VerificationCard({
  verification,
  onApprove,
  onReject,
  onZoomImage,
}: {
  verification: KycVerification;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onZoomImage: (url: string) => void;
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
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-zinc-50/40 transition-all duration-300"
        type="button"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200/60 transition-colors duration-300">
            <IdCard size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-zinc-950 truncate text-base group-hover:text-zinc-900 transition-colors">{pd?.fullName ?? "Sin nombre"}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              DNI {pd?.documentNumber ?? "—"} · Enviado {formatDate(verification.submittedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${statusBadge(verification.status)}`}>
            {STATUS_LABELS[verification.status] ?? verification.status}
          </span>
          <div className="h-7 w-7 rounded-full flex items-center justify-center bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
            {expanded ? <ChevronUp size={15} className="text-zinc-600" /> : <ChevronDown size={15} className="text-zinc-600" />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/20 px-6 py-6 space-y-6">

          {/* Personal data grid */}
          {pd && (
            <div className="bg-white border border-zinc-100 rounded-xl p-5 grid gap-4 grid-cols-2 sm:grid-cols-3">
              {([
                ["CUIL/CUIT", pd.cuilCuit, <User size={14} className="text-zinc-400" />],
                ["Fecha de nac.", pd.birthDate, <Calendar size={14} className="text-zinc-400" />],
                ["Teléfono", pd.phone, <Smartphone size={14} className="text-zinc-400" />],
                ["Domicilio", pd.address, <MapPin size={14} className="text-zinc-400" />],
                ["Ciudad", pd.city, <MapPin size={14} className="text-zinc-400" />],
                ["Provincia", pd.province, <MapPin size={14} className="text-zinc-400" />],
              ] as [string, string, ReactNode][]).map(([label, value, icon]) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {icon}
                    <span>{label}</span>
                  </div>
                  <p className="font-semibold text-zinc-850 text-sm mt-0.5">{value || "—"}</p>
                </div>
              ))}
            </div>
          )}

          {/* Document images */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <FileText size={13} />
              <span>Documentos presentados</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">DNI — Frente</p>
                <DocImage url={frontDoc?.previewUrl} label="DNI Frente" onZoom={() => frontDoc?.previewUrl && onZoomImage(frontDoc.previewUrl)} />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">DNI — Dorso</p>
                <DocImage url={backDoc?.previewUrl} label="DNI Dorso" onZoom={() => backDoc?.previewUrl && onZoomImage(backDoc.previewUrl)} />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Selfie</p>
                <DocImage url={selfieDoc?.previewUrl} label="Selfie · Verificación" onZoom={() => selfieDoc?.previewUrl && onZoomImage(selfieDoc.previewUrl)} />
              </div>
            </div>
          </div>

          {/* Actions */}
          {verification.status === "IN_REVIEW" && (
            <div className="space-y-3 pt-2">
              {rejectMode ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all resize-none shadow-sm"
                    placeholder="Motivo del rechazo (visible para el usuario)..."
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={handleReject} disabled={!reason.trim() || loading} className="flex-1 h-10 rounded-xl">
                      <XCircle size={14} />
                      {loading ? "Rechazando..." : "Confirmar rechazo"}
                    </Button>
                    <Button variant="secondary" onClick={() => setRejectMode(false)} className="h-10 rounded-xl">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={handleApprove} disabled={loading} className="flex-1 h-11 rounded-xl font-bold shadow-sm hover:shadow active:scale-[0.99] transition-all">
                    <CheckCircle2 size={16} />
                    {loading ? "Aprobando..." : "Aprobar verificación"}
                  </Button>
                  <Button variant="danger" onClick={() => setRejectMode(true)} disabled={loading} className="flex-1 h-11 rounded-xl font-bold active:scale-[0.99] transition-all">
                    <XCircle size={16} />
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          )}

          {verification.status === "REJECTED" && verification.rejectionReason && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-800 uppercase tracking-wide">Motivo del rechazo:</p>
                <p className="text-sm text-rose-700 leading-relaxed font-medium">{verification.rejectionReason}</p>
              </div>
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  const countInReview = verifications.filter((v) => v.status === "IN_REVIEW").length;
  const countRejected = verifications.filter((v) => v.status === "REJECTED").length;
  const countAll      = verifications.length;

  const countMap = {
    IN_REVIEW: countInReview,
    REJECTED: countRejected,
    all: countAll,
  };

  const filtered = filter === "all" ? verifications : verifications.filter((v) => v.status === filter);

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Admin Panel</p>
          <h1 className="mt-1 text-3xl font-black text-zinc-950 tracking-tight">Verificaciones KYC</h1>
          <p className="mt-1.5 text-sm text-zinc-500 font-medium">
            Revisá la documentación de identidad y aprobá o rechazá cada solicitud.
          </p>
        </div>
      </div>

      {/* Modern Segmented Control Filters */}
      <div className="flex gap-1.5 bg-zinc-100 p-1.5 rounded-xl w-fit border border-zinc-200/50">
        {([
          { key: "IN_REVIEW", label: "En revisión" },
          { key: "REJECTED",  label: "Rechazadas" },
          { key: "all",       label: "Todas" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            type="button"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
              filter === key
                ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/30"
                : "text-zinc-500 hover:text-zinc-850"
            }`}
          >
            <span>{label}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold transition-all ${
              filter === key 
                ? "bg-zinc-950 text-white" 
                : "bg-zinc-250 text-zinc-500 group-hover:bg-zinc-300"
            }`}>
              {countMap[key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array(2).fill(null).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100/70 border border-zinc-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 border border-zinc-200/40 flex items-center justify-center text-zinc-400 mb-4 shadow-sm">
            <IdCard size={22} />
          </div>
          <h3 className="text-sm font-bold text-zinc-900">No hay verificaciones</h3>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-xs font-medium leading-relaxed">
            No se encontraron solicitudes en este estado en este momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((v) => (
            <VerificationCard 
              key={v.id} 
              verification={v} 
              onApprove={handleApprove} 
              onReject={handleReject} 
              onZoomImage={setLightboxUrl}
            />
          ))}
        </div>
      )}

      {/* Lightbox zoom modal */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
