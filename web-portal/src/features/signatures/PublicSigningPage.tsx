import { AlertCircle, CheckCircle, Download, FileSignature, KeyRound, Move } from "lucide-react";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { Button } from "../../shared/components/ui/Button";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { apiClient } from "../../shared/services/apiClient";
import { useAuth } from "../../app/providers/AuthProvider";


interface SignatureRequestDetails {
  id: string;
  document_id: string;
  signer_email: string;
  signer_name: string;
  status: string;
  accepted_conformity: boolean;
  document: {
    title: string;
  };
  current_version: {
    file_name: string;
    sha256_hash: string;
  };
}

export function PublicSigningPage({ token, id, onComplete }: { token?: string; id?: string; onComplete?: () => void }) {
  const { user } = useAuth();
  const isUnverified = !!user && user.verificationStatus !== "VERIFIED";

  const [request, setRequest] = useState<SignatureRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF blob URL
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Drag states (representing visual container: 400x560 px)
  const [pos, setPos] = useState({ x: 180, y: 440 }); // Visual top-left coordinates inside container
  const posRef = useRef(pos);
  const [size, setSize] = useState({ width: 180, height: 60 });
  const [page, setPage] = useState<number>(1);

  // Sync posRef with pos state on changes (e.g. presets)
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Conformity states
  const [acceptedConformity, setAcceptedConformity] = useState(false);
  const [conformityCheckbox, setConformityCheckbox] = useState(false);
  const [acceptingConformity, setAcceptingConformity] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const apiBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000/api";

  // Fetch signature request details
  useEffect(() => {
    const fetchUrl = token ? `/signature-requests/${token}` : `/signature-requests/id/${id}`;
    apiClient.get<{ data: SignatureRequestDetails }>(fetchUrl)
      .then((res) => {
        setRequest(res.data);
        if (res.data.status === "SIGNED") {
          setSigned(true);
        }
        if (res.data.status === "REJECTED") {
          setRejected(true);
        }
        setAcceptedConformity(res.data.accepted_conformity);
      })
      .catch((err) => {
        console.error(err);
        setError("La solicitud de firma no existe, ha expirado o no tienes permisos.");
      })
      .finally(() => setLoading(false));
  }, [token, id]);

  // Load PDF as blob to support authorization headers in iframe
  useEffect(() => {
    if (!request) return;
    const downloadUrl = token 
      ? `${apiBase}/signature-requests/${token}/download`
      : `${apiBase}/documents/${request.document_id}/download`;

    const headers: Record<string, string> = {};
    const jwt = localStorage.getItem("accessToken");
    if (!token && jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }

    fetch(downloadUrl, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el archivo PDF.");
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((err) => {
        console.error(err);
        setError("Error al cargar la previsualización del documento PDF.");
      });

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [request, token, id]);

  // Drag handlers
  function handleMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (signed) return;
    isDragging.current = true;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const dragRect = dragRef.current?.getBoundingClientRect();
    if (dragRect) {
      dragStartOffset.current = {
        x: e.clientX - dragRect.left,
        y: e.clientY - dragRect.top
      };
    }
    document.addEventListener("mousemove", handleMouseMoveGlobal);
    document.addEventListener("mouseup", handleMouseUpGlobal);
  }

  function handleMouseMoveGlobal(e: any) {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate new position relative to container
    let newX = e.clientX - containerRect.left - dragStartOffset.current.x;
    let newY = e.clientY - containerRect.top - dragStartOffset.current.y;

    // Boundaries
    const maxX = containerRect.width - size.width;
    const maxY = containerRect.height - size.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    posRef.current = { x: newX, y: newY };
    if (dragRef.current) {
      dragRef.current.style.left = `${newX}px`;
      dragRef.current.style.top = `${newY}px`;
    }
  }

  function handleMouseUpGlobal() {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMoveGlobal);
    document.removeEventListener("mouseup", handleMouseUpGlobal);
    setPos(posRef.current);
  }

  // Preset placements
  function applyPreset(preset: "bottom-left" | "bottom-right" | "center") {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    if (preset === "bottom-left") {
      setPos({ x: 20, y: h - size.height - 20 });
    } else if (preset === "bottom-right") {
      setPos({ x: w - size.width - 20, y: h - size.height - 20 });
    } else if (preset === "center") {
      setPos({ x: (w - size.width) / 2, y: (h - size.height) / 2 });
    }
  }

  async function handleAcceptConformity() {
    if (!request) return;
    setAcceptingConformity(true);
    setError(null);
    const conformityUrl = token ? `/signature-requests/${token}/conformity` : `/signature-requests/id/${id}/conformity`;
    try {
      await apiClient.post(conformityUrl, {
        acceptanceText: "Declaro haber leido y aceptado el contenido del documento, prestando conformidad de manera libre, voluntaria e informada."
      });
      setAcceptedConformity(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al registrar la conformidad.");
    } finally {
      setAcceptingConformity(false);
    }
  }

  async function handleSign() {
    if (!request) return;
    setSigning(true);
    setError(null);

    // Translate visual coordinates (400x560 px) to PDF A4 points (595x842 pt)
    const containerW = 400;
    const containerH = 560;
    const pdfPageW = 595;
    const pdfPageH = 842;

    const pdfX = Math.round((pos.x / containerW) * pdfPageW);
    const pdfY = Math.round(((containerH - pos.y - size.height) / containerH) * pdfPageH);
    const pdfW = Math.round((size.width / containerW) * pdfPageW);
    const pdfH = Math.round((size.height / containerH) * pdfPageH);

    const signUrl = token ? `/signature-requests/${token}/sign` : `/signature-requests/id/${id}/sign`;

    try {
      await apiClient.post(signUrl, {
        acceptedTerms: true,
        signatureType: "DIGITAL_CERTIFICATE",
        metadata: {
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          page: page
        }
      });
      setSigned(true);
      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al procesar la firma criptográfica.");
    } finally {
      setSigning(false);
    }
  }

  async function handleReject() {
    if (!request) return;
    const reason = window.prompt("Ingrese el motivo del rechazo (opcional):");
    if (reason === null) return; // Cancelled
    
    setRejecting(true);
    setError(null);
    const rejectUrl = token ? `/signature-requests/${token}/reject` : `/signature-requests/id/${id}/reject`;
    
    try {
      await apiClient.post(rejectUrl, { reason });
      setRejected(true);
      alert("La solicitud de firma ha sido rechazada.");
      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al procesar el rechazo.");
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center text-zinc-500 p-4">
        <p className="text-sm font-semibold">Verificando solicitud de firma segura...</p>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="grid min-h-[300px] place-items-center p-4">
        <Card className="max-w-md w-full rounded-2xl border border-zinc-200/50 shadow-xl bg-white">
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-rose-50 border border-rose-100 text-rose-600">
              <AlertCircle size={22} />
            </div>
            <h1 className="text-lg font-bold text-zinc-950">Error</h1>
            <p className="text-xs text-zinc-600 leading-relaxed">{error}</p>
            {onComplete ? (
              <Button type="button" variant="secondary" onClick={onComplete} className="h-9 px-4 rounded-lg text-xs mt-2">
                Volver
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  const directDownloadUrl = token 
    ? `${apiBase}/signature-requests/${token}/download`
    : `${apiBase}/documents/${request?.document_id}/download`;

  return (
    <div className="text-zinc-950 space-y-6">
      <PageHeader
        eyebrow="Portal de Firma Seguro"
        title={request?.document.title || "Firma de documento"}
        description={`Solicitado a ${request?.signer_email} · Trazabilidad completa por hash SHA-256.`}
        action={
          signed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
              <CheckCircle size={13} /> ✓ Firmado
            </span>
          ) : rejected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
              <AlertCircle size={13} /> Rechazado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
              Pendiente de firma
            </span>
          )
        }
      />

      {error ? (
        <div className="rounded-xl bg-rose-50/50 border border-rose-100 p-4 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Visual PDF and Signature Drag Zone */}
        <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-zinc-50 via-zinc-100/30 to-zinc-200/50 rounded-3xl p-8 border border-zinc-200/60 shadow-inner w-full flex-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest self-start mb-1">Previsualización y Ubicación de Firma</h3>
          
          <div className="relative flex gap-4 w-full justify-center py-4">
            {/* Simulator page (400x560 pixels representing A4) */}
            <div 
              ref={containerRef}
              className="relative w-[400px] h-[560px] bg-white border border-zinc-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden select-none transition-all duration-300 hover:scale-[1.002]"
            >
              {/* Embed PDF inside simulator for reading */}
              {pdfUrl ? (
                <iframe 
                  src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                  className="w-full h-full pointer-events-none" 
                  title="PDF Preview"
                />
              ) : (
                <div className="w-full h-full grid place-items-center bg-zinc-50/50 text-xs text-zinc-400">
                  Cargando PDF...
                </div>
              )}

              {/* Visible Draggable Signature Seal Overlay */}
              {!signed && !rejected ? (
                <div
                  ref={dragRef}
                  className="absolute cursor-grab active:cursor-grabbing border border-dashed border-emerald-500 bg-emerald-500/10 backdrop-blur-[1px] rounded-xl p-3 text-[10px] font-bold text-emerald-950 shadow-[0_8px_30px_rgba(16,185,129,0.12)] select-none flex flex-col justify-center transition-transform duration-200 hover:scale-102"
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <div className="absolute top-2.5 right-2.5 text-emerald-600">
                    <Move size={12} />
                  </div>
                  <span className="text-emerald-700 tracking-widest text-[8px] uppercase font-mono font-bold">FIRMA DIGITAL · PÁG {page}</span>
                  <span className="truncate text-zinc-900 mt-1 font-semibold text-[9px]">{request?.signer_name || request?.signer_email}</span>
                  <span className="text-zinc-400 mt-0.5 text-[8px] font-normal">Arrastra para ubicar</span>
                </div>
              ) : signed ? (
                // Signed status indicator at the location
                <div
                  className="absolute border border-emerald-500 bg-emerald-50/90 backdrop-blur-[2px] rounded-xl p-3 text-[10px] font-bold text-emerald-950 shadow-md flex flex-col justify-center"
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                  }}
                >
                  <span className="text-emerald-700 tracking-widest text-[8px] uppercase font-mono font-bold">✓ FIRMADO DIGITALMENTE · PÁG {page}</span>
                  <span className="truncate text-zinc-900 mt-1 font-semibold text-[9px]">{request?.signer_name || request?.signer_email}</span>
                  <span className="text-emerald-600/70 mt-0.5 text-[8px] font-normal">Sello criptográfico incrustado</span>
                </div>
              ) : null}
            </div>
          </div>
          
          {!signed && !rejected ? (
            <p className="text-xs text-zinc-400 font-medium">
              Mantén presionado y arrastra el recuadro para ubicar visualmente el sello en la página {page}.
            </p>
          ) : null}
        </div>

        {/* Action sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Detalles del documento" subtitle="Evidencias y metadatos registrados." />
            <div className="p-5 space-y-4 text-sm">
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Firmante</span>
                <span className="font-semibold text-zinc-800">{request?.signer_name || request?.signer_email}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Email</span>
                <span className="font-semibold text-zinc-800 truncate max-w-[200px]" title={request?.signer_email}>{request?.signer_email}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Archivo</span>
                <span className="font-semibold text-zinc-800 truncate max-w-[200px]" title={request?.current_version.file_name}>{request?.current_version.file_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Hash original</span>
                <span className="font-mono text-xs text-zinc-400" title={request?.current_version.sha256_hash}>{request?.current_version.sha256_hash.slice(0, 16)}...</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader 
              title="Ejecutar Acción" 
              subtitle={
                rejected
                  ? "Solicitud rechazada"
                  : isUnverified 
                    ? "Identidad requerida" 
                    : !acceptedConformity 
                      ? "Paso 1: Conformidad" 
                      : "Paso 2: Firma digital"
              } 
            />
            <div className="p-5 space-y-4">
              {rejected ? (
                <div className="space-y-4">
                  <div className="flex gap-2.5 rounded-xl border border-rose-100 bg-rose-50/50 p-3.5 text-xs text-rose-800 leading-normal">
                    <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={14} />
                    <div>
                      <p className="font-bold">Firma rechazada</p>
                      <p className="mt-1 text-zinc-600 font-normal">Has rechazado la firma de este documento.</p>
                    </div>
                  </div>
                </div>
              ) : !signed ? (
                <>
                  {isUnverified ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-rose-50/50 border border-rose-100 p-3.5 text-xs text-rose-800 leading-relaxed font-semibold">
                        Debes verificar tu identidad antes de poder firmar este documento.
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Por favor, realiza el proceso de validación en la sección de <strong>Identidad</strong> de tu cuenta. Una vez que tu solicitud sea aprobada por un administrador, podrás aplicar tu firma digital.
                      </p>
                    </div>
                  ) : !acceptedConformity ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3.5 text-xs text-amber-800 leading-relaxed">
                        Antes de aplicar tu firma digital, es un requisito legal registrar tu conformidad de que has leído y estás de acuerdo con el contenido completo del documento.
                      </div>

                      <label className="flex gap-3 text-xs text-zinc-700 cursor-pointer select-none leading-normal">
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0 rounded border-zinc-200 bg-white accent-emerald-500 cursor-pointer"
                          checked={conformityCheckbox}
                          onChange={(e) => setConformityCheckbox(e.target.checked)}
                        />
                        <span>
                          Declaro haber leído y aceptado el contenido de este documento, prestando conformidad de manera libre, voluntaria e informada.
                        </span>
                      </label>

                      <Button
                        className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={!conformityCheckbox || acceptingConformity}
                        onClick={handleAcceptConformity}
                      >
                        {acceptingConformity ? "Registrando..." : "Aceptar Conformidad"}
                      </Button>

                      <button
                        type="button"
                        className="w-full text-center text-xs text-rose-600 hover:text-rose-700 font-semibold mt-2 block transition"
                        onClick={handleReject}
                        disabled={rejecting}
                      >
                        {rejecting ? "Procesando..." : "Rechazar firma"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800 font-semibold items-center">
                        <CheckCircle size={14} className="text-emerald-600" /> Conformidad registrada
                      </div>

                      <div className="space-y-2 border-t border-zinc-100 pt-4">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Posicionamiento rápido</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-zinc-200 bg-zinc-50/50 py-1.5 px-2 text-xs hover:bg-zinc-100/50 text-zinc-700 active:scale-[0.98] transition-all duration-150"
                            onClick={() => applyPreset("bottom-left")}
                          >
                            Abajo Izq
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-zinc-200 bg-zinc-50/50 py-1.5 px-2 text-xs hover:bg-zinc-100/50 text-zinc-700 active:scale-[0.98] transition-all duration-150"
                            onClick={() => applyPreset("center")}
                          >
                            Centro
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-zinc-200 bg-zinc-50/50 py-1.5 px-2 text-xs hover:bg-zinc-100/50 text-zinc-700 active:scale-[0.98] transition-all duration-150"
                            onClick={() => applyPreset("bottom-right")}
                          >
                            Abajo Der
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-zinc-100 pt-4">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Tamaño del sello</label>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-zinc-600">
                            <span>Ancho: {size.width}px</span>
                            <input 
                              type="range" min="100" max="250" value={size.width} 
                              onChange={(e) => setSize(s => ({ ...s, width: parseInt(e.target.value) }))}
                              className="w-1/2 cursor-pointer accent-zinc-900"
                            />
                          </div>
                          <div className="flex justify-between text-xs text-zinc-600">
                            <span>Alto: {size.height}px</span>
                            <input 
                              type="range" min="40" max="100" value={size.height} 
                              onChange={(e) => setSize(s => ({ ...s, height: parseInt(e.target.value) }))}
                              className="w-1/2 cursor-pointer accent-zinc-900"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-zinc-100 pt-4">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Página del documento</label>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-600">Incrustar firma en página:</span>
                          <input 
                            type="number" 
                            min="1" 
                            value={page} 
                            onChange={(e) => setPage(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-center font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 bg-white"
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-normal">
                          Indique el número de página (ej. 1, 2, 3...) donde se aplicará visualmente el sello.
                        </p>
                      </div>

                      <div className="border-t border-zinc-100 pt-4 text-xs text-zinc-500 leading-relaxed">
                        Al firmar este documento, se incrustará una firma digital criptográfica que garantiza que el contenido no ha sido modificado y valida tu autoría.
                      </div>

                      <Button 
                        className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
                        onClick={handleSign}
                        disabled={signing}
                      >
                        <FileSignature size={16} /> {signing ? "Procesando firma..." : "Firmar Documento"}
                      </Button>

                      <button
                        type="button"
                        className="w-full text-center text-xs text-rose-600 hover:text-rose-700 font-semibold mt-2 block transition"
                        onClick={handleReject}
                        disabled={rejecting}
                      >
                        {rejecting ? "Procesando..." : "Rechazar firma"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 text-xs text-emerald-800 leading-normal">
                    <KeyRound className="shrink-0 mt-0.5 text-emerald-600" size={14} />
                    <div>
                      <p className="font-bold">Firma criptográfica aplicada</p>
                      <p className="mt-1 text-zinc-600 font-normal">El documento PDF ha sido firmado y resellado de forma segura.</p>
                    </div>
                  </div>

                  <Button 
                    className="w-full justify-center"
                    onClick={() => {
                      if (token) {
                        window.open(directDownloadUrl);
                      } else {
                        // For logged-in users, download with auth header using direct window download helper or fetch
                        const jwt = localStorage.getItem("accessToken");
                        fetch(directDownloadUrl, {
                          headers: { Authorization: `Bearer ${jwt}` }
                        })
                          .then(res => res.blob())
                          .then(blob => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = request?.current_version.file_name || "signed_document.pdf";
                            a.click();
                            URL.revokeObjectURL(url);
                          });
                      }
                    }}
                  >
                    <Download size={16} /> Descargar PDF firmado
                  </Button>
                </div>
              )}
            </div>
          </Card>
          
          {onComplete ? (
            <Button type="button" variant="secondary" className="w-full justify-center" onClick={onComplete}>
              Volver a solicitudes
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

