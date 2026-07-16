import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSignature,
  FileText,
  PenLine,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import {
  generateConsolidatedPdfBlob,
  getMySigningRequests,
  tryGenerateConsolidatedPdf,
} from "../../shared/services/signing.service";
import { getOrgAuthorities, type OrgAuthority } from "../../shared/services/authorities.service";
import { getMyOrganization } from "../../shared/services/organizations.service";
import type { SigningRequest } from "../../shared/types/signing";
import { downloadBlob, signedPdfFileName } from "../../shared/utils/downloadFileName";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function isExpired(r: SigningRequest) {
  return new Date(r.expiresAt) < new Date() && r.status !== "SIGNED" && r.status !== "REJECTED";
}

function getStatusDetail(r: SigningRequest): string {
  if (r.status === "SIGNED")   return `Firmado el ${formatDate(r.signedAt ?? r.sentAt)}`;
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

const AUTHORITY_STATUS_LABEL: Record<string, string> = {
  PENDING:  "Pendiente de aceptación",
  ACTIVE:   "Activa",
  REVOKED:  "Revocada",
  EXPIRED:  "Expirada",
};

const AUTHORITY_STATUS_COLOR: Record<string, string> = {
  PENDING:  "text-amber-700 bg-amber-50 border-amber-200",
  ACTIVE:   "text-emerald-700 bg-emerald-50 border-emerald-200",
  REVOKED:  "text-red-600 bg-red-50 border-red-200",
  EXPIRED:  "text-zinc-500 bg-zinc-50 border-zinc-200",
};

export function SignaturesPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [requests,     setRequests]     = useState<SigningRequest[]>([]);
  const [myAuthority,  setMyAuthority]  = useState<OrgAuthority | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;

    const loadRequests = getMySigningRequests(user.email).then(setRequests);

    // Buscar si este usuario es autoridad en alguna org
    const loadAuthority = getMyOrganization()
      .then((org) => {
        if (!org) return;
        return getOrgAuthorities(org.id).then((auths) => {
          const mine = auths.find((a) => a.email === user.email);
          if (mine) setMyAuthority(mine);
        });
      })
      .catch(() => null);

    Promise.all([loadRequests, loadAuthority])
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar contratos"))
      .finally(() => setLoading(false));
  }, [user?.email]);

  const pending = requests.filter((r) => r.status !== "SIGNED" && r.status !== "REJECTED" && !isExpired(r));
  const history = requests.filter((r) => r.status === "SIGNED" || r.status === "REJECTED" || isExpired(r));
  const [activeTab, setActiveTab] = useState<"contracts" | "history">("contracts");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portal de firmas"
        title="Mis contratos"
        description="Documentos que requieren tu firma y tu rol como autoridad."
      />

      {/* ─── Estado de autoridad ─────────────────────────────────────────────── */}
      {myAuthority && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-zinc-500" />
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Tu rol como autoridad firmante
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-zinc-900">{myAuthority.fullName}</p>
              <p className="text-xs text-zinc-500">
                {myAuthority.type === "PERMANENT" ? "Autoridad permanente" : "Autoridad provisional"}
                {myAuthority.cuil ? ` · CUIL ${myAuthority.cuil}` : ""}
              </p>
            </div>
            <span className={`self-start sm:self-auto rounded-lg border px-3 py-1 text-xs font-semibold ${AUTHORITY_STATUS_COLOR[myAuthority.status] ?? ""}`}>
              {AUTHORITY_STATUS_LABEL[myAuthority.status] ?? myAuthority.status}
            </span>
          </div>
          {myAuthority.status === "PENDING" && myAuthority.inviteToken && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
              <p className="text-sm text-amber-800">
                Te invitaron a ser autoridad firmante de esta organización.
                {myAuthority.type === "PERMANENT"
                  ? " Necesitás registrar tu firma para habilitar tu acceso."
                  : " Necesitás firmar el convenio para activar tu rol."}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/authority/accept/${myAuthority.inviteToken}`)}
                className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition"
              >
                {myAuthority.type === "PERMANENT" ? "Registrar mi firma" : "Firmar convenio"}
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-zinc-500">Cargando contratos...</p>}

      {error && <EmptyState icon={AlertCircle} title="Error al cargar" description={error} />}

      {/* ─── Pestañas ─────────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
            {([
              { key: "contracts", label: "Mis contratos", count: pending.length },
              { key: "history",   label: "Historial",    count: history.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === key
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    activeTab === key ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contenido de pestañas */}
          {activeTab === "contracts" ? (
            pending.length > 0 ? (
              <div className="space-y-3">
                {pending.map((r) => (
                  <ContractCard key={r.id} r={r} navigate={navigate} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileSignature}
                title="Sin contratos pendientes"
                description="No tenés contratos que requieran tu firma en este momento."
              />
            )
          ) : (
            history.length > 0 ? (
              <div className="space-y-3">
                {history.map((r) => (
                  <ContractCard key={r.id} r={r} navigate={navigate} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileSignature}
                title="Sin historial"
                description="Tus contratos firmados, rechazados o expirados van a aparecer acá."
              />
            )
          )}

          {requests.length === 0 && !myAuthority && (
            <EmptyState
              icon={FileSignature}
              title="Sin contratos asignados"
              description="Cuando un documento requiera tu firma, va a aparecer acá."
            />
          )}
        </div>
      )}
    </div>
  );
}

function ContractCard({
  r,
  navigate,
}: {
  r: SigningRequest;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [refreshingPdf, setRefreshingPdf] = useState(false);
  const expired = isExpired(r);
  const canSign = r.status !== "SIGNED" && r.status !== "REJECTED" && !expired;

  async function openDocument() {
    setRefreshingPdf(true);
    try {
      let url: string | null = r.finalPdfUrl ?? r.pdfUrl;
      if (r.status === "SIGNED") {
        const pdfBlob = await generateConsolidatedPdfBlob(r.documentId);
        if (pdfBlob) {
          url = URL.createObjectURL(pdfBlob);
          void tryGenerateConsolidatedPdf(r.documentId);
        } else {
          url = null;
        }
      }
      if (!url) {
        window.alert("No se pudo preparar el PDF completo. Intentá de nuevo en unos segundos.");
        return;
      }
      if (url.startsWith("blob:")) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const separator = url.includes("?") ? "&" : "?";
        window.open(`${url}${separator}v=${Date.now()}`, "_blank", "noopener,noreferrer");
      }
    } finally {
      setRefreshingPdf(false);
    }
  }

  return (
    <div className={`rounded-2xl border bg-white transition hover:shadow-sm ${canSign ? "border-zinc-300 shadow-sm" : "border-zinc-200"}`}>
      {/* Franja superior de estado */}
      {canSign && (
        <div className="rounded-t-2xl px-5 py-2 flex items-center gap-2" style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
          <Clock size={12} />
          <span className="text-[11px] font-bold uppercase tracking-widest">Requiere tu firma</span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Fila principal */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Logo de org o ícono fallback */}
          <div className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden border border-zinc-100 ${
            r.organizationLogo ? "bg-white p-1" : r.status === "SIGNED" ? "bg-emerald-50" : expired ? "bg-zinc-100" : "bg-amber-50"
          }`}>
            {r.organizationLogo
              ? <img src={r.organizationLogo} alt={r.organizationName ?? ""} className="h-full w-full object-contain" />
              : <StatusIcon r={r} />
            }
          </div>

          <div className="min-w-0 flex-1">
            {/* Empresa emisora */}
            {r.organizationName && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5 flex items-center gap-1">
                <Building2 size={10} /> {r.organizationName}
              </p>
            )}

            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="font-bold text-zinc-900 leading-tight">{r.documentTitle || "Contrato pendiente"}</p>
              <Badge status={expired ? "EXPIRED" : r.status} />
            </div>

            {/* Metadatos */}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
              {r.senderName && (
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <User size={11} className="shrink-0" /> Firma: <strong>{r.senderName}</strong>
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Clock size={11} className="shrink-0" /> {getStatusDetail(r)}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100">
          {canSign ? (
            <Button onClick={() => navigate(`/signing/${r.id}`)} className="h-9 px-5 text-xs">
              <PenLine size={13} /> Firmar ahora
            </Button>
          ) : r.status === "SIGNED" ? (
            <>
              {r.templateId ? (
                /* Contrato de plantilla: el PDF correcto se descarga desde la vista renderizada */
                <Button
                  className="h-9 px-4 text-xs"
                  onClick={() => navigate(`/signing/${r.id}`)}
                >
                  <FileSignature size={13} /> Ver y descargar contrato
                </Button>
              ) : (
                /* Contrato por PDF subido: descargar el archivo */
                <>
                  <Button
                    variant="secondary"
                    className="h-9 px-4 text-xs"
                    disabled={refreshingPdf}
                    onClick={async () => {
                      const blob = await generateConsolidatedPdfBlob(r.documentId);
                      if (blob) downloadBlob(blob, signedPdfFileName({ title: r.documentTitle, fileName: r.fileName, sequence: r.versionNumber }));
                    }}
                  >
                    <Download size={13} /> Descargar
                  </Button>
                  <Button onClick={openDocument} disabled={refreshingPdf} className="h-9 px-4 text-xs">
                    <Eye size={13} /> {refreshingPdf ? "Preparando..." : "Ver PDF"}
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={() => navigate(`/signing/${r.id}`)} className="h-9 px-4 text-xs">
              <FileText size={13} /> Ver detalles
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
