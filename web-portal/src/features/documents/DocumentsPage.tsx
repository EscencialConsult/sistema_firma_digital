import { AlertCircle, Download, Eye, FileSignature, FileUp, Files, Plus, Send, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { getAccessToken } from "../../shared/services/apiClient";
import { DocumentRecord, documentsApi, Pkcs11Certificate, Pkcs11Token } from "./services/documents.api";

function shortHash(value?: string) {
  return value ? value.slice(0, 16) : "sin hash";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "sin fecha";
}

function pickPreferredCertificate(certificates: Pkcs11Certificate[]) {
  return certificates.find((certificate) => certificate.label?.includes("SERIALNUMBER=CUIL"))
    ?? certificates.find((certificate) => !certificate.label?.toLowerCase().includes("localhost"))
    ?? certificates[0];
}

interface SignerInput {
  email: string;
  name: string;
  order: number;
}

type ConfirmAction = {
  type: "download" | "delete";
  document: DocumentRecord;
};

export function DocumentsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiResource(documentsApi.list, []);
  const canUsePkcs11 = user?.role === "ADMIN" || user?.role === "ORGANIZATION_ADMIN";
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Send Signature Request Modal States
  const [selectedDocForSend, setSelectedDocForSend] = useState<DocumentRecord | null>(null);
  const [signers, setSigners] = useState<SignerInput[]>([{ email: "", name: "", order: 1 }]);
  const [expiresInDays, setExpiresInDays] = useState(15);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Details Modal States
  const [detailsDoc, setDetailsDoc] = useState<DocumentRecord & { signature_requests?: any[] } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  // PKCS#11 signing modal states
  const [selectedDocForPkcs11, setSelectedDocForPkcs11] = useState<DocumentRecord | null>(null);
  const [pkcs11Pin, setPkcs11Pin] = useState("");
  const [pkcs11CertId, setPkcs11CertId] = useState("");
  const [pkcs11Tokens, setPkcs11Tokens] = useState<Pkcs11Token[]>([]);
  const [pkcs11ModulePath, setPkcs11ModulePath] = useState("");
  const [detectingPkcs11, setDetectingPkcs11] = useState(false);
  const [pkcs11Signing, setPkcs11Signing] = useState(false);
  const [pkcs11Error, setPkcs11Error] = useState<string | null>(null);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      await documentsApi.upload({ title: title || file.name, file });
      setTitle("");
      setFile(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await documentsApi.remove(id);
    await reload();
  }

  async function handleDownload(doc: DocumentRecord) {
    const apiBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000/api";
    const downloadUrl = `${apiBase}/documents/${doc.id}/download`;
    const jwt = getAccessToken();
    
    try {
      const res = await fetch(downloadUrl, {
        credentials: "include",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
      });
      if (!res.ok) throw new Error("No se pudo descargar el archivo.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || `${doc.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error al descargar el archivo.");
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || confirmingAction) return;

    setConfirmingAction(true);
    try {
      if (confirmAction.type === "download") {
        await handleDownload(confirmAction.document);
      } else {
        await handleDelete(confirmAction.document.id);
      }
      setConfirmAction(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "No se pudo completar la accion.");
    } finally {
      setConfirmingAction(false);
    }
  }

  async function handleOpenDetailsModal(doc: DocumentRecord) {
    try {
      const res = await documentsApi.get(doc.id);
      setDetailsDoc(res);
    } catch (err) {
      console.error(err);
      alert("No se pudieron obtener los detalles del documento.");
    }
  }

  function handleOpenSendModal(doc: DocumentRecord) {
    setSelectedDocForSend(doc);
    setSigners([{ email: "", name: "", order: 1 }]);
    setExpiresInDays(15);
    setSendError(null);
  }

  async function handleOpenPkcs11Modal(doc: DocumentRecord) {
    setSelectedDocForPkcs11(doc);
    setPkcs11Pin("");
    setPkcs11CertId("");
    setPkcs11ModulePath("");
    setPkcs11Tokens([]);
    setPkcs11Error(null);
    await handleDetectPkcs11Tokens();
  }

  async function handleDetectPkcs11Tokens(pin?: string) {
    setDetectingPkcs11(true);
    setPkcs11Error(null);
    try {
      const result = await documentsApi.detectPkcs11Tokens(pin);
      setPkcs11Tokens(result.tokens);
      const firstUsableToken = result.tokens.find((token) => !token.error);
      if (firstUsableToken && !pkcs11ModulePath) {
        setPkcs11ModulePath(firstUsableToken.modulePath);
        const preferredCertificate = pickPreferredCertificate(firstUsableToken.certificates);
        if (preferredCertificate) setPkcs11CertId(preferredCertificate.id);
      }
      if (!result.tokens.length) {
        setPkcs11Error("No se detectaron tokens. Verifica que OpenSC este instalado y el token conectado.");
      }
    } catch (err) {
      setPkcs11Error(err instanceof Error ? err.message : "No se pudieron detectar tokens PKCS#11.");
    } finally {
      setDetectingPkcs11(false);
    }
  }

  async function handlePkcs11Submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedDocForPkcs11) return;
    setPkcs11Signing(true);
    setPkcs11Error(null);
    try {
      await documentsApi.signWithPkcs11(selectedDocForPkcs11.id, {
        pin: pkcs11Pin,
        certId: pkcs11CertId.trim() || undefined,
        modulePath: pkcs11ModulePath || undefined,
        slot: selectedPkcs11Token?.slot || undefined,
        metadata: {
          x: 50,
          y: 50,
          width: 190,
          height: 64,
          page: 1
        }
      });
      setSelectedDocForPkcs11(null);
      await reload();
    } catch (err) {
      setPkcs11Error(err instanceof Error ? err.message : "No se pudo firmar con PKCS#11.");
    } finally {
      setPkcs11Signing(false);
    }
  }

  function handleAddSigner() {
    setSigners((current) => [
      ...current,
      { email: "", name: "", order: current.length + 1 }
    ]);
  }

  function handleRemoveSigner(index: number) {
    setSigners((current) => current.filter((_, i) => i !== index));
  }

  function handleSignerChange(index: number, field: keyof SignerInput, value: string | number) {
    setSigners((current) =>
      current.map((signer, i) =>
        i === index ? { ...signer, [field]: value } : signer
      )
    );
  }

  async function handleSendSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedDocForSend) return;

    // Validate inputs
    const validSigners = signers.filter((s) => s.email.trim() !== "");
    if (validSigners.length === 0) {
      setSendError("Debe agregar al menos un firmante con email válido.");
      return;
    }

    setSendingRequest(true);
    setSendError(null);
    try {
      await documentsApi.sendDocument(selectedDocForSend.id, {
        signers: validSigners.map((s) => ({
          email: s.email,
          name: s.name || undefined,
          signingOrder: s.order
        })),
        expiresInDays
      });
      setSelectedDocForSend(null);
      await reload();
    } catch (err: any) {
      console.error(err);
      setSendError(err?.message || "Error al enviar el documento.");
    } finally {
      setSendingRequest(false);
    }
  }

  const selectedPkcs11Token = pkcs11Tokens.find((token) => token.modulePath === pkcs11ModulePath);
  const selectedTokenUsesWindows = selectedPkcs11Token?.modulePath === "windows-cert-store";

  return (
    <>
      <PageHeader
        eyebrow="Gesti?n documental"
        title="Mis documentos"
        description="Subi PDFs, calcula hash, controla estados y envia solicitudes de firma con trazabilidad."
      />

      <Card className="mb-6">
        <CardHeader title="Subir documento" subtitle="El archivo queda versionado en storage y registrado en PostgreSQL." />
        <form className="grid gap-3.5 p-5 md:grid-cols-[1.2fr_1fr_auto]" onSubmit={handleUpload}>
          <input
            className="rounded-xl border border-zinc-200/80 px-4 py-2.5 text-sm outline-none focus:border-zinc-400 transition"
            placeholder="Título del documento"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            accept="application/pdf"
            className="rounded-xl border border-zinc-200/80 px-4 py-2.5 text-sm bg-white cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200/60"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button type="submit" disabled={!file || saving} className="h-[42px]"><FileUp size={16} /> {saving ? "Subiendo..." : "Subir PDF"}</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Repositorio seguro" subtitle="Documentos reales guardados por el backend." />
        {loading ? <p className="p-5 text-sm text-zinc-500">Cargando documentos...</p> : null}
        {error ? <div className="p-5"><EmptyState icon={AlertCircle} title="No se pudieron cargar documentos" description={error} /></div> : null}
        {!loading && !error && !data?.length ? (
          <div className="p-5">
            <EmptyState icon={Files} title="Sin documentos" description="Subí tu primer PDF para empezar a operar con datos reales." />
          </div>
        ) : null}
        {data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/30 text-xs font-semibold text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Hash</th>
                  <th className="px-5 py-3">Actualizado</th>
                  <th className="sticky right-0 z-10 min-w-[260px] bg-zinc-50/95 px-5 py-3 text-right shadow-[-10px_0_18px_-18px_rgba(0,0,0,0.45)]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/70">
                {data.map((document) => (
                  <tr key={document.id} className="group hover:bg-zinc-50/30 transition duration-150">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-zinc-950">{document.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{document.file_name ?? "PDF"}</p>
                    </td>
                    <td className="px-5 py-4"><Badge status={document.status} /></td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">{shortHash(document.sha256_hash)}</td>
                    <td className="px-5 py-4 text-zinc-500">{formatDate(document.updated_at)}</td>
                    <td className="sticky right-0 z-10 bg-white px-5 py-4 shadow-[-10px_0_18px_-18px_rgba(0,0,0,0.45)] transition-colors group-hover:bg-zinc-50">
                      <div className="flex min-w-[260px] flex-wrap items-center justify-end gap-1.5">
                        {document.status === "DRAFT" ? (
                          <Button variant="secondary" type="button" onClick={() => handleOpenSendModal(document)} className="h-8 shrink-0 rounded-lg px-3 text-xs">
                            <Send size={13} /> Enviar
                          </Button>
                        ) : (
                          <Button variant="secondary" type="button" onClick={() => void handleOpenDetailsModal(document)} className="h-8 shrink-0 rounded-lg px-3 text-xs">
                            <Eye size={13} /> Seguimiento
                          </Button>
                        )}
                        {canUsePkcs11 ? (
                          <Button variant="secondary" type="button" onClick={() => void handleOpenPkcs11Modal(document)} className="h-8 shrink-0 rounded-lg px-3 text-xs">
                            <FileSignature size={13} /> PKCS#11
                          </Button>
                        ) : null}
                        <Button variant="secondary" type="button" title="Descargar" aria-label="Descargar documento" onClick={() => setConfirmAction({ type: "download", document })} className="h-8 w-8 shrink-0 rounded-lg !p-0">
                          <Download className="h-3.5 w-3.5 shrink-0" />
                        </Button>
                        <Button variant="secondary" type="button" title="Eliminar" aria-label="Eliminar documento" onClick={() => setConfirmAction({ type: "delete", document })} className="h-8 w-8 shrink-0 rounded-lg !p-0 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {/* Send Signature Request Modal */}
      {selectedDocForSend ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200/50 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Enviar solicitud de firma</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Documento: {selectedDocForSend.title}</p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
                onClick={() => setSelectedDocForSend(null)}
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSendSubmit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {sendError ? (
                  <div className="rounded-xl bg-rose-50/60 border border-rose-100 p-3 text-xs font-semibold text-rose-800">
                    {sendError}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Firmantes asignados</h4>
                  {signers.map((signer, index) => (
                    <div key={index} className="grid gap-2 border-b border-zinc-50 pb-3 last:border-0 last:pb-0 md:grid-cols-[1.5fr_1fr_60px_auto]">
                      <input
                        type="email"
                        placeholder="email@ejemplo.com"
                        className="rounded-xl border border-zinc-200/80 px-3 py-1.5 text-xs outline-none focus:border-zinc-400 transition"
                        required
                        value={signer.email}
                        onChange={(e) => handleSignerChange(index, "email", e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Nombre (opcional)"
                        className="rounded-xl border border-zinc-200/80 px-3 py-1.5 text-xs outline-none focus:border-zinc-400 transition"
                        value={signer.name}
                        onChange={(e) => handleSignerChange(index, "name", e.target.value)}
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Orden"
                        className="rounded-xl border border-zinc-200/80 px-2 py-1.5 text-xs outline-none focus:border-zinc-400 text-center transition"
                        required
                        value={signer.order}
                        onChange={(e) => handleSignerChange(index, "order", parseInt(e.target.value) || 1)}
                      />
                      {signers.length > 1 ? (
                        <button
                          type="button"
                          className="grid place-items-center rounded-xl p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition"
                          onClick={() => handleRemoveSigner(index)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : <div />}
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-bold text-zinc-700 hover:text-zinc-950 mt-1 transition active:scale-[0.98]"
                    onClick={handleAddSigner}
                  >
                    <Plus size={14} className="text-zinc-400" /> Añadir firmante
                  </button>
                </div>

                <div className="border-t border-zinc-100 pt-4">
                  <label className="text-xs font-bold text-zinc-700 block mb-2">
                    Expiración del enlace: <span className="text-zinc-950">{expiresInDays} días</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="90"
                    className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 bg-zinc-50/50 rounded-b-2xl">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setSelectedDocForSend(null)}
                  disabled={sendingRequest}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={sendingRequest}>
                  <Send size={14} /> {sendingRequest ? "Enviando..." : "Enviar a firmar"}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {selectedDocForPkcs11 ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200/50 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Firmar con PKCS#11</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Documento: {selectedDocForPkcs11.title}</p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 transition-all hover:bg-zinc-50 hover:text-zinc-700 active:scale-95"
                onClick={() => setSelectedDocForPkcs11(null)}
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handlePkcs11Submit}>
              <div className="space-y-4 p-6">
                {pkcs11Error ? (
                  <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-xs font-semibold text-rose-800">
                    {pkcs11Error}
                  </div>
                ) : null}

                <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
                  Token detectado
                  <select
                    className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    value={pkcs11ModulePath}
                    onChange={(event) => {
                      const modulePath = event.target.value;
                      setPkcs11ModulePath(modulePath);
                      const token = pkcs11Tokens.find((item) => item.modulePath === modulePath);
                      setPkcs11CertId(token ? pickPreferredCertificate(token.certificates)?.id ?? "" : "");
                    }}
                  >
                    <option value="">Seleccionar token</option>
                    {pkcs11Tokens.filter((token) => !token.error).map((token) => (
                      <option key={`${token.modulePath}-${token.slot ?? ""}`} value={token.modulePath}>
                        {token.label || token.moduleName} {token.serial ? `- ${token.serial}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" type="button" onClick={() => void handleDetectPkcs11Tokens()} disabled={detectingPkcs11} className="h-9 rounded-lg px-3 text-xs">
                    {detectingPkcs11 ? "Detectando..." : "Detectar tokens"}
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => void handleDetectPkcs11Tokens(pkcs11Pin)} disabled={!pkcs11Pin || detectingPkcs11} className="h-9 rounded-lg px-3 text-xs">
                    Buscar certificados
                  </Button>
                </div>

                {!selectedTokenUsesWindows ? (
                  <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
                    PIN del token
                    <input
                      className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                      type="password"
                      value={pkcs11Pin}
                      onChange={(event) => setPkcs11Pin(event.target.value)}
                      required
                    />
                  </label>
                ) : null}

                <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
                  Certificado
                  {selectedPkcs11Token?.certificates.length ? (
                    <select
                      className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                      value={pkcs11CertId}
                      onChange={(event) => setPkcs11CertId(event.target.value)}
                    >
                      {selectedPkcs11Token.certificates.map((certificate) => (
                        <option key={certificate.id} value={certificate.id}>
                          {certificate.label || "Certificado"} - ID {certificate.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                    className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    placeholder="Presiona Buscar certificados o ingresa el ID"
                    value={pkcs11CertId}
                    onChange={(event) => setPkcs11CertId(event.target.value)}
                    />
                  )}
                </label>

                <p className="text-xs leading-relaxed text-zinc-500">
                  {selectedTokenUsesWindows ? "Windows va a pedir el PIN del token al firmar si el certificado lo requiere." : "La app detecta tokens conectados al servidor. El PIN se usa solo para buscar certificados y firmar."}
                </p>
              </div>

              <footer className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
                <Button variant="secondary" type="button" onClick={() => setSelectedDocForPkcs11(null)} disabled={pkcs11Signing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={(!selectedTokenUsesWindows && !pkcs11Pin) || !pkcs11ModulePath || !pkcs11CertId || pkcs11Signing}>
                  <FileSignature size={14} /> {pkcs11Signing ? "Firmando..." : "Firmar"}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200/50 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-zinc-950">
                  {confirmAction.type === "download" ? "Confirmar descarga" : "Confirmar eliminacion"}
                </h3>
                <p className="mt-0.5 truncate text-xs text-zinc-500" title={confirmAction.document.title}>
                  Documento: {confirmAction.document.title}
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 transition-all hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setConfirmAction(null)}
                disabled={confirmingAction}
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-3 p-6">
              <p className="text-sm leading-relaxed text-zinc-600">
                {confirmAction.type === "download"
                  ? "La descarga de este documento se va a iniciar en tu equipo."
                  : "Esta accion eliminara el documento del sistema. No se puede deshacer."}
              </p>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-700">Archivo:</span> {confirmAction.document.file_name || confirmAction.document.title}
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={confirmingAction}
              >
                Cancelar
              </Button>
              <Button
                variant={confirmAction.type === "delete" ? "danger" : "primary"}
                type="button"
                onClick={() => void handleConfirmAction()}
                disabled={confirmingAction}
              >
                {confirmAction.type === "download" ? <Download size={14} /> : <Trash2 size={14} />}
                {confirmingAction ? "Procesando..." : confirmAction.type === "download" ? "Descargar" : "Eliminar"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Document Details Modal */}
      {detailsDoc ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200/50 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Seguimiento del Documento</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Título: {detailsDoc.title}</p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
                onClick={() => setDetailsDoc(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50/50 rounded-2xl p-4 border border-zinc-100">
                <div>
                  <span className="text-zinc-400 block font-medium">Estado General</span>
                  <div className="mt-1.5"><Badge status={detailsDoc.status} /></div>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Hash actual</span>
                  <span className="mt-1.5 block font-mono text-zinc-700 truncate" title={detailsDoc.sha256_hash}>{detailsDoc.sha256_hash}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Subido el</span>
                  <span className="mt-1.5 block text-zinc-700">{formatDate(detailsDoc.created_at)}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Nombre de archivo</span>
                  <span className="mt-1.5 block text-zinc-700 truncate" title={detailsDoc.file_name}>{detailsDoc.file_name}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Flujo de firmas y firmantes</h4>
                {detailsDoc.signature_requests && detailsDoc.signature_requests.length > 0 ? (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {detailsDoc.signature_requests.map((req: any, index: number) => (
                      <div key={req.id} className="flex items-center justify-between border border-zinc-100 rounded-xl p-3.5 hover:bg-zinc-50/30 transition-all duration-150">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-900">
                            Firmante {index + 1}: {req.signer_name || "Invitado"}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5 truncate">{req.signer_email}</p>
                          {req.signed_at ? (
                            <p className="text-[10px] text-emerald-600 mt-1 font-semibold">
                              Firmado el: {formatDate(req.signed_at)}
                            </p>
                          ) : req.viewed_at ? (
                            <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                              Visto el: {formatDate(req.viewed_at)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-zinc-400 mt-1">
                              Pendiente desde: {formatDate(req.sent_at)}
                            </p>
                          )}
                        </div>
                        <div className="ml-3 shrink-0">
                          <Badge status={req.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">No hay solicitudes de firma registradas.</p>
                )}
              </div>
            </div>

            <footer className="flex items-center justify-end border-t border-zinc-100 px-6 py-4 bg-zinc-50/50 rounded-b-2xl">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setDetailsDoc(null)}
              >
                Cerrar
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
