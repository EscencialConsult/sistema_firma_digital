import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  PenLine,
  ShieldCheck,
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
import { getOrgAuthorities, type OrgAuthority } from "../../shared/services/authorities.service";
import { getMyOrganization } from "../../shared/services/organizations.service";
import type { SigningRequest } from "../../shared/types/signing";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
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

  return (
    <div className="space-y-8">
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

      {/* ─── Pendientes de firmar ─────────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                Pendientes de firma
              </p>
              {pending.map((r) => (
                <ContractCard key={r.id} r={r} navigate={navigate} />
              ))}
            </div>
          )}

          {/* ─── Historial ──────────────────────────────────────────────────── */}
          {history.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                Historial
              </p>
              {history.map((r) => (
                <ContractCard key={r.id} r={r} navigate={navigate} />
              ))}
            </div>
          )}

          {requests.length === 0 && !myAuthority && (
            <EmptyState
              icon={FileSignature}
              title="Sin contratos asignados"
              description="Cuando un documento requiera tu firma, va a aparecer acá."
            />
          )}
        </>
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
  const expired = isExpired(r);
  const canSign = r.status !== "SIGNED" && r.status !== "REJECTED" && !expired;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition">
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
          {r.finalPdfUrl && (
            <a
              href={r.finalPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
            >
              <Download size={12} /> PDF firmado
            </a>
          )}
          {canSign ? (
            <Button onClick={() => navigate(`/signing/${r.id}`)} className="h-9 px-4 text-xs">
              <PenLine size={13} /> Firmar ahora
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate(`/signing/${r.id}`)} className="h-9 px-4 text-xs">
              Ver detalles
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
