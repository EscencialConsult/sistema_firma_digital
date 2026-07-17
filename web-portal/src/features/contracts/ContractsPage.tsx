import { CheckCircle2, Clock3, Download, Eye, FileSignature, Files, Mail, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { getOrganization } from "../../shared/services/organizations.service";
import {
  generateConsolidatedPdfBlob,
  getMySigningRequests,
  tryGenerateConsolidatedPdf,
} from "../../shared/services/signing.service";
import type { SigningRequest } from "../../shared/types/signing";
import { downloadBlob, signedPdfDownloadUrl, signedPdfFileName } from "../../shared/utils/downloadFileName";
import { buildSignedPdfsEmail } from "../../shared/utils/shareEmail";

type EmailProvider = "mailto" | "gmail" | "outlook";

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

function openEmailComposer(provider: EmailProvider, input: { to: string; subject: string; body: string }) {
  const encodedTo = encodeURIComponent(input.to);
  const encodedSubject = encodeURIComponent(input.subject);
  const encodedBody = encodeURIComponent(input.body);
  const toParam = input.to.trim() ? `to=${encodedTo}&` : "";
  const mailtoTo = input.to.trim() ? encodedTo : "";
  const href = provider === "gmail"
    ? `https://mail.google.com/mail/?view=cm&fs=1&${toParam}su=${encodedSubject}&body=${encodedBody}`
    : provider === "outlook"
      ? `https://outlook.office.com/mail/deeplink/compose?${toParam}subject=${encodedSubject}&body=${encodedBody}`
      : `mailto:${mailtoTo}?subject=${encodedSubject}&body=${encodedBody}`;

  window.open(href, "_blank", "noopener,noreferrer");
}

export function ContractsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SigningRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "signed" | "rejected">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePreparing, setSharePreparing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareTo, setShareTo] = useState("");
  const [shareSubject, setShareSubject] = useState("");
  const [shareBody, setShareBody] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.organizationId) return;
    getOrganization(user.organizationId).then((org) => setOrgName(org?.name ?? null)).catch(() => {});
  }, [user?.organizationId]);

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
  const selectedSigned = requests.filter((r) => selectedIds.includes(r.id) && r.status === "SIGNED");
  const visibleSigned = filtered.filter((r) => r.status === "SIGNED");
  const allVisibleSignedSelected = visibleSigned.length > 0 && visibleSigned.every((r) => selectedIds.includes(r.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function toggleVisibleSigned() {
    if (allVisibleSignedSelected) {
      const visibleIds = new Set(visibleSigned.map((r) => r.id));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleSigned.map((r) => r.id)])));
  }

  async function prepareShareDraft() {
    if (selectedSigned.length === 0) return;
    setSharePreparing(true);
    setShareError(null);
    setShareCopied(false);

    try {
      const prepared = await Promise.all(selectedSigned.map(async (r) => {
        const url = await tryGenerateConsolidatedPdf(r.documentId);
        return {
          title: r.documentTitle,
          fileName: signedPdfFileName({
            title: r.documentTitle,
            fileName: r.fileName,
            sequence: r.versionNumber,
          }),
          url: url ? signedPdfDownloadUrl(r.documentId) : null,
        };
      }));

      const withLinks = prepared.filter((item): item is typeof item & { url: string } => !!item.url);
      if (withLinks.length === 0) {
        setShareError("No se pudieron preparar links de descarga para los PDFs seleccionados.");
        return;
      }

      const { subject, body } = buildSignedPdfsEmail({ documents: withLinks, organizationName: orgName ?? undefined });
      setShareSubject(subject);
      setShareBody(body);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "No se pudo preparar el email.");
    } finally {
      setSharePreparing(false);
    }
  }

  function openShareModal() {
    setShareOpen(true);
    void prepareShareDraft();
  }

  function handleShare(provider: EmailProvider) {
    if (!shareSubject.trim() || !shareBody.trim()) {
      setShareError("Primero prepará el mensaje para enviar.");
      return;
    }

    openEmailComposer(provider, {
      to: shareTo,
      subject: shareSubject,
      body: shareBody,
    });
    setShareOpen(false);
  }

  async function copyShareMessage() {
    const text = [
      shareTo.trim() ? `Para: ${shareTo.trim()}` : "",
      `Asunto: ${shareSubject}`,
      "",
      shareBody,
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="flex flex-wrap items-center gap-2">
          {visibleSigned.length > 0 && (
            <button
              type="button"
              onClick={toggleVisibleSigned}
              className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-400"
            >
              {allVisibleSignedSelected ? "Quitar firmados" : "Seleccionar firmados"}
            </button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedSigned.length === 0}
            onClick={openShareModal}
          >
            <Mail size={13} /> Enviar por email
            {selectedSigned.length > 0 && (
              <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {selectedSigned.length}
              </span>
            )}
          </Button>
        </div>
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
                    {r.status === "SIGNED" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        className="mt-2 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                        aria-label={`Seleccionar ${r.documentTitle}`}
                      />
                    )}
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
                    {isPending ? (
                      <Link to={`/signing/${r.id}`}>
                        <Button className="h-8 px-4 text-xs">
                          <FileSignature size={13} /> Firmar
                        </Button>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        {r.status === "SIGNED" && (
                          <Button
                            variant="secondary"
                            className="h-8 px-4 text-xs"
                            onClick={async () => {
                              const blob = await generateConsolidatedPdfBlob(r.documentId);
                              if (blob) {
                                downloadBlob(blob, signedPdfFileName({
                                  title: r.documentTitle,
                                  fileName: r.fileName,
                                  sequence: r.versionNumber,
                                }));
                              }
                            }}
                          >
                            <Download size={13} /> Descargar
                          </Button>
                        )}
                        <Link to={`/contracts/${r.documentId}`}>
                          <Button variant="secondary" className="h-8 px-4 text-xs">
                            <Eye size={13} /> Ver detalle
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {shareOpen && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-6 backdrop-blur-sm">
          <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-7 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Email</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-950">Compartir contratos firmados</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Revisá el destinatario y el mensaje antes de abrir tu correo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-7 py-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden">
              <div className="space-y-3 lg:self-start">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-bold text-zinc-800">
                    {selectedSigned.length} {selectedSigned.length === 1 ? "PDF seleccionado" : "PDFs seleccionados"}
                  </p>
                  <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
                    {selectedSigned.map((r) => (
                      <div key={r.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                        <p className="truncate text-xs font-semibold text-zinc-700">
                          {signedPdfFileName({ title: r.documentTitle, fileName: r.fileName, sequence: r.versionNumber })}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-400">{r.documentTitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Links seguros</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                    El correo incluye links cortos del portal. Los PDFs no se adjuntan automaticamente.
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Para</label>
                  <input
                    type="text"
                    value={shareTo}
                    onChange={(e) => setShareTo(e.target.value)}
                    placeholder="destinatario@empresa.com"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Asunto</label>
                  <input
                    type="text"
                    value={shareSubject}
                    onChange={(e) => setShareSubject(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Mensaje</label>
                  <textarea
                    value={shareBody}
                    onChange={(e) => setShareBody(e.target.value)}
                    rows={14}
                    className="min-h-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              {shareError && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 lg:col-span-2">
                  {shareError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-100 bg-white px-7 py-4 sm:flex-row sm:items-center">
              <Button disabled={sharePreparing || !shareBody.trim()} onClick={() => handleShare("gmail")} className="h-10 w-full sm:w-auto sm:px-8">
                <Mail size={14} /> {sharePreparing ? "Preparando..." : "Abrir Gmail"}
              </Button>
              <Button disabled={sharePreparing || !shareBody.trim()} variant="secondary" onClick={() => handleShare("outlook")} className="h-10 w-full sm:w-auto sm:px-6">
                <Mail size={14} /> Abrir Outlook
              </Button>
              <Button disabled={sharePreparing || !shareBody.trim()} variant="secondary" onClick={() => handleShare("mailto")} className="h-10 w-full sm:w-auto sm:px-6">
                <Mail size={14} /> Abrir app de correo
              </Button>
              <Button disabled={!shareBody.trim()} variant="ghost" onClick={copyShareMessage} className="h-10 w-full sm:ml-auto sm:w-auto sm:px-5">
                {shareCopied ? "Mensaje copiado" : "Copiar mensaje"}
              </Button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
