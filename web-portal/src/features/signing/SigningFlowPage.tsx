import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSignature,
  Hash,
  PenLine,
  Shield,
  ShieldCheck,
  Trash2,
  XCircle,
  Camera,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ContractDocument } from "../admin/components/ContractRenderer";
import { loadOrgCache } from "../../shared/config/orgCache";
import { Button } from "../../shared/components/ui/Button";
import { Stepper } from "../../shared/components/ui/Stepper";
import {
  acceptConformity,
  executeSignature,
  generateConsolidatedPdfBlob,
  generatePerSignerSignedPdf,
  getMySignatureDataForRequest,
  getSigningRequest,
  tryGenerateConsolidatedPdf,
  verifyFaceLocal,
} from "../../shared/services/signing.service";
import { downloadBlob, signedPdfFileName } from "../../shared/utils/downloadFileName";
import type { SignatureResult, SigningRequest } from "../../shared/types/signing";

type StepIndex = 0 | 1 | 2 | 3;

// ─── Shared: captura el .contract-doc-wrapper como PDF A4 ─────────────────────

const normFilename = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-").toLowerCase();

const PDF_MARGIN_X = 15;
const PDF_MARGIN_Y = 20;
const PDF_CONTENT_W = 210 - PDF_MARGIN_X * 2;
const PDF_CONTENT_H = 297 - PDF_MARGIN_Y * 2;

async function makeDocHeader(logoUrl: string | null, orgName: string, title: string): Promise<HTMLElement> {
  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:24px;border-bottom:2px solid #18181b;";
  if (logoUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.style.cssText = "height:36px;object-fit:contain;max-width:140px;";
    img.src = logoUrl;
    header.appendChild(img);
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); setTimeout(res, 2000); });
  } else {
    const nameEl = document.createElement("strong");
    nameEl.textContent = orgName;
    nameEl.style.fontSize = "15px";
    header.appendChild(nameEl);
  }
  const metaEl = document.createElement("div");
  metaEl.style.textAlign = "right";
  metaEl.innerHTML = `<div style="font-size:11px;font-weight:600;color:#0a0a0a">${title}</div><div style="font-size:9px;color:#71717a;margin-top:2px">${orgName} · Ley 25.506</div>`;
  header.appendChild(metaEl);
  return header;
}

async function captureCanvasFromEl(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
}

async function buildContractPdf({
  title, signerName, logoUrl, orgName,
}: { title: string; signerName: string; logoUrl: string | null; orgName: string }) {
  const wrapper = document.querySelector(".contract-doc-wrapper") as HTMLElement | null;
  if (!wrapper) return null;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:760px;background:white;padding:48px;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#09090b;z-index:-1;";
  container.appendChild(await makeDocHeader(logoUrl, orgName, title));

  const clone = wrapper.cloneNode(true) as HTMLElement;
  clone.style.cssText = "max-height:none;overflow:visible;box-shadow:none;border:none;border-radius:0;background:white;";
  container.appendChild(clone);
  document.body.appendChild(container);
  await new Promise((r) => setTimeout(r, 200));

  const containerTop = container.getBoundingClientRect().top;
  const blockEls = Array.from(container.querySelectorAll("p, h1, h2, h3, h4, h5, h6"));
  const rawCandidates: number[] = [];
  for (let i = 0; i < blockEls.length - 1; i++) {
    const currBottom = (blockEls[i] as HTMLElement).getBoundingClientRect().bottom - containerTop;
    const nextTop = (blockEls[i + 1] as HTMLElement).getBoundingClientRect().top - containerTop;
    const gapMid = nextTop > currBottom ? (currBottom + nextTop) / 2 : currBottom + 2;
    rawCandidates.push(Math.round(gapMid * 2));
  }
  const sigBlock = container.querySelector("[data-sig-block]") as HTMLElement | null;
  let sigTopPx = -1, sigBottomPx = -1;
  if (sigBlock) {
    const r = sigBlock.getBoundingClientRect();
    sigTopPx = Math.round((r.top - containerTop) * 2) - 8;
    sigBottomPx = Math.round((r.bottom - containerTop) * 2);
    rawCandidates.push(sigTopPx);
  }
  const breakCandidates = rawCandidates
    .filter((px) => sigTopPx < 0 || px <= sigTopPx || px >= sigBottomPx)
    .sort((a, b) => a - b);

  const canvas = await captureCanvasFromEl(container);
  document.body.removeChild(container);

  const cw = canvas.width;
  const pageH_px = Math.round(canvas.height * (PDF_CONTENT_H / ((canvas.height * PDF_CONTENT_W) / cw)));
  const breakPxs: number[] = [0];
  let pos = 0;
  while (pos + pageH_px < canvas.height) {
    const target = pos + pageH_px;
    const minBreak = pos + Math.round(pageH_px * 0.3);
    let best = target;
    for (let i = breakCandidates.length - 1; i >= 0; i--) {
      if (breakCandidates[i] <= target && breakCandidates[i] >= minBreak) { best = breakCandidates[i]; break; }
    }
    breakPxs.push(best);
    pos = best;
  }
  breakPxs.push(canvas.height);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  for (let p = 0; p < breakPxs.length - 1; p++) {
    if (p > 0) pdf.addPage();
    const sy = breakPxs[p], ey = breakPxs[p + 1], sliceH_px = ey - sy;
    const sliceH_mm = (sliceH_px * PDF_CONTENT_W) / cw;
    const sc = document.createElement("canvas");
    sc.width = cw; sc.height = sliceH_px;
    const sCtx = sc.getContext("2d")!;
    sCtx.fillStyle = "#fff"; sCtx.fillRect(0, 0, cw, sliceH_px);
    sCtx.drawImage(canvas, 0, sy, cw, sliceH_px, 0, 0, cw, sliceH_px);
    pdf.addImage(sc.toDataURL("image/jpeg", 0.92), "JPEG", PDF_MARGIN_X, PDF_MARGIN_Y, PDF_CONTENT_W, sliceH_mm);
  }
  return { pdf, title, signerName };
}

async function downloadContractAsPdf(args: { title: string; signerName: string; logoUrl: string | null; orgName: string }): Promise<void> {
  const result = await buildContractPdf(args);
  if (!result) return;
  result.pdf.save(`${normFilename(result.title)}_${normFilename(result.signerName)}.pdf`);
}

interface AuditPdfParams {
  title: string;
  signerName: string;
  logoUrl: string | null;
  orgName: string;
  autorNombre: string;
  autorCuil: string;
  autorEmail: string;
  autorSigUrl: string;
  signerEmail: string;
  signerCuil: string;
  signerDni: string;
  signatureData: string | null;
  ipAddress: string | null;
  faceSimilarity: number | null;
  signedAt: string | null;
  documentHash: string | null;
}

async function downloadContractWithAuditPdf(args: AuditPdfParams): Promise<void> {
  const result = await buildContractPdf(args);
  if (!result) return;
  const { pdf } = result;

  // ── Página de auditoría ──────────────────────────────────────────────────────
  const auditEl = document.createElement("div");
  auditEl.style.cssText =
    "position:fixed;left:-9999px;top:0;width:760px;background:white;padding:48px;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#09090b;z-index:-1;";
  auditEl.appendChild(await makeDocHeader(args.logoUrl, args.orgName, args.title));

  // Título
  const titleSec = document.createElement("div");
  titleSec.style.cssText = "text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e4e4e7;";
  titleSec.innerHTML = `
    <p style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:#71717a;margin:0">Registro de Auditoría</p>
    <p style="font-size:18px;font-weight:800;color:#09090b;margin:6px 0 4px">Certificado de Firma Electrónica</p>
    <p style="font-size:10px;color:#71717a;margin:0">Ley N° 25.506 · República Argentina</p>`;
  auditEl.appendChild(titleSec);

  // Firmas (dos columnas)
  const partiesGrid = document.createElement("div");
  partiesGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;";

  function partyCard(badge: string, badgeColor: string, rows: [string, string][], sigUrl: string | null): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #e4e4e7;border-radius:12px;padding:16px;";
    const b = document.createElement("div");
    b.style.cssText = `display:inline-block;border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;margin-bottom:12px;${badgeColor}`;
    b.textContent = badge;
    card.appendChild(b);
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #f4f4f5;font-size:11px;";
      row.innerHTML = `<span style="color:#71717a;font-weight:600">${label}</span><span style="color:#09090b;text-align:right">${value || "—"}</span>`;
      card.appendChild(row);
    }
    if (sigUrl) {
      const sigWrap = document.createElement("div");
      sigWrap.style.cssText = "margin-top:14px;text-align:center;";
      const sigImg = document.createElement("img");
      sigImg.src = sigUrl;
      sigImg.crossOrigin = "anonymous";
      sigImg.style.cssText = "max-height:56px;max-width:160px;object-fit:contain;display:block;margin:0 auto 4px;";
      const sigLabel = document.createElement("p");
      sigLabel.style.cssText = "font-size:9px;color:#a1a1aa;margin:0";
      sigLabel.textContent = "Firma digital registrada";
      sigWrap.appendChild(sigImg);
      sigWrap.appendChild(sigLabel);
      card.appendChild(sigWrap);
    }
    return card;
  }

  const ts = args.signedAt ? new Date(args.signedAt).toLocaleString("es-AR") : "—";
  partiesGrid.appendChild(partyCard(
    "AUTORIDAD FIRMANTE", "background:#eff6ff;color:#1d4ed8;",
    [["Nombre", args.autorNombre], ["CUIL/CUIT", args.autorCuil], ["Email", args.autorEmail], ["Rol", "Representante Legal"]],
    args.autorSigUrl || null,
  ));
  partiesGrid.appendChild(partyCard(
    "FIRMANTE", "background:#ecfdf5;color:#065f46;",
    [
      ["Nombre", args.signerName],
      ["Email", args.signerEmail],
      ...(args.signerCuil ? [["CUIL/CUIT", args.signerCuil] as [string, string]] : []),
      ...(args.signerDni  ? [["DNI",        args.signerDni]  as [string, string]] : []),
      ["IP registrada", args.ipAddress || "—"],
      ["Fecha y hora", ts],
      ...(args.faceSimilarity !== null ? [["Similitud facial", `${args.faceSimilarity}%`] as [string, string]] : []),
    ],
    args.signatureData,
  ));
  auditEl.appendChild(partiesGrid);

  // Proceso verificado
  const processSec = document.createElement("div");
  processSec.style.cssText = "margin-bottom:16px;";
  processSec.innerHTML = `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#71717a;margin:0 0 8px">Proceso de firma verificado</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      ${["Conformidad legal aceptada","Verificación facial completada","OTP de identidad validado","Firma manuscrita digital registrada"]
        .map(s => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#3f3f46"><span style="color:#10b981;font-size:13px">✓</span>${s}</div>`).join("")}
    </div>`;
  auditEl.appendChild(processSec);

  // Hash
  const hashSec = document.createElement("div");
  hashSec.style.cssText = "border:1px solid #e4e4e7;border-radius:10px;padding:12px;margin-bottom:16px;background:#fafafa;";
  hashSec.innerHTML = `<p style="font-size:10px;font-weight:700;color:#71717a;margin:0 0 4px">Hash SHA-256 del documento</p>
    <p style="font-family:monospace;font-size:10px;color:#09090b;word-break:break-all;margin:0">${args.documentHash || "—"}</p>`;
  auditEl.appendChild(hashSec);

  // Nota legal
  const legalSec = document.createElement("div");
  legalSec.style.cssText = "border:1px solid #bbf7d0;border-radius:10px;padding:12px;background:#f0fdf4;";
  legalSec.innerHTML = `<p style="font-size:11px;font-weight:700;color:#166534;margin:0 0 4px">✓ Firma Electrónica Válida</p>
    <p style="font-size:10px;color:#166534;margin:0;line-height:1.5">Proceso realizado conforme a la Ley N° 25.506 de Firma Digital de la República Argentina. Método: OTP + Reconocimiento facial + Firma manuscrita digital.</p>`;
  auditEl.appendChild(legalSec);

  document.body.appendChild(auditEl);

  // Precargar imágenes de firma antes de capturar
  const sigImgs = Array.from(auditEl.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(sigImgs.map((img) => new Promise<void>((res) => {
    if (img.complete) { res(); return; }
    img.onload = () => res(); img.onerror = () => res(); setTimeout(res, 2000);
  })));
  await new Promise((r) => setTimeout(r, 150));

  const auditCanvas = await captureCanvasFromEl(auditEl);
  document.body.removeChild(auditEl);

  pdf.addPage();
  const auditH_mm = (auditCanvas.height * PDF_CONTENT_W) / auditCanvas.width;
  pdf.addImage(auditCanvas.toDataURL("image/jpeg", 0.92), "JPEG", PDF_MARGIN_X, PDF_MARGIN_Y, PDF_CONTENT_W, auditH_mm);

  pdf.save(`auditoria_${normFilename(args.title)}_${normFilename(args.signerName)}.pdf`);
}

const STEPS = [
  "Conformidad legal",
  "Verificación facial",
  "Tu firma",
  "Confirmación",
] as const;

// ─── Step 0: Conformidad ──────────────────────────────────────────────────────

function ConformityStep({
  request,
  onAccept,
  loading,
}: {
  request: SigningRequest;
  onAccept: () => void;
  loading: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const cached = loadOrgCache();
      await downloadContractAsPdf({
        title:     request.documentTitle,
        signerName: request.signerName,
        logoUrl:   request.organizationLogo ?? cached?.logoLightUrl ?? cached?.logoDarkUrl ?? null,
        orgName:   request.organizationName ?? cached?.name ?? "Firma Electrónica",
      });
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h2 className="text-xl font-bold text-zinc-950">Declaración de conformidad</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Leé el documento y la declaración antes de continuar.
        </p>
      </div>

      <div className="contract-outer-box rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden">
        {/* Header */}
        <div className="no-print flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileSignature size={16} className="shrink-0 text-zinc-500" />
            <p className="truncate text-sm font-semibold text-zinc-900">{request.documentTitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {request.sha256Hash && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Hash size={11} />
                <span className="font-mono">{request.sha256Hash.slice(0, 16)}...</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition disabled:opacity-50"
            >
              {downloading
                ? <RefreshCw size={12} className="animate-spin" />
                : <Download size={12} />
              }
              {downloading ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        </div>

        {/* Contract content — rendered from template or placeholder */}
        {request.templateId && request.templateFields ? (
          <div className="[&_.contract-doc-wrapper]:max-h-[72vh] [&_.contract-doc-wrapper]:rounded-none [&_.contract-doc-wrapper]:border-0 [&_.contract-doc-wrapper]:shadow-none [&_.contract-doc-wrapper]:bg-white [&_.contract-doc-wrapper]:text-[14px] [&_.contract-doc-wrapper]:leading-7">
            <ContractDocument
              templateId={request.templateId}
              fields={request.templateFields}
              logoUrl={request.organizationLogo}
              orgName={request.organizationName}
              alumnos={[
                {
                  nombre:    request.templateFields.nombre_firmante || request.signerName,
                  email:     request.templateFields.email_firmante || request.signerEmail,
                  dni:       request.templateFields.dni_firmante || request.templateFields.documento_numero || "",
                  cuil:      request.templateFields.cuil_firmante || request.templateFields.cuil_cuit || "",
                  domicilio: request.templateFields.domicilio_firmante || "",
                },
                {
                  nombre:    request.templateFields.nombre_firmante_2 || "",
                  email:     request.templateFields.email_firmante_2 || "",
                  dni:       request.templateFields.dni_firmante_2 || "",
                  cuil:      request.templateFields.cuil_firmante_2 || "",
                  domicilio: request.templateFields.domicilio_firmante_2 || "",
                }
              ]}
            />
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center px-6">
            <FileSignature size={32} className="text-zinc-300 mb-2" />
            <p className="text-sm font-medium text-zinc-400">Vista previa del documento</p>
            <p className="text-xs text-zinc-400 mt-1">
              Este documento no tiene template asociado. Revisá con el administrador.
            </p>
          </div>
        )}
      </div>

      <div className="no-print rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
          <Shield size={16} className="text-zinc-700" />
          Declaración de conformidad legal
        </div>
        <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 leading-relaxed space-y-2">
          <p>
            Declaro que he leído y comprendido en su totalidad el documento{" "}
            <span className="font-semibold">"{request.documentTitle}"</span>, y expreso mi
            conformidad con todas las cláusulas y condiciones.
          </p>
          <p>
            Entiendo que esta declaración tiene validez legal conforme a la Ley N° 25.506 de Firma
            Digital de la República Argentina, y que la posterior firma electrónica tendrá plena
            eficacia probatoria.
          </p>
          <p>
            Reconozco que el documento y esta declaración quedarán registrados con mi IP, fecha,
            hora y dispositivo para garantizar la trazabilidad e inmutabilidad del proceso.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                style={{ accentColor: "var(--brand-primary)" }}
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span className="text-sm text-zinc-700">
            <span className="font-semibold">Confirmo que leí y acepto</span> la declaración de
            conformidad legal y los términos del documento descripto.
          </span>
        </label>
      </div>

      <Button onClick={onAccept} disabled={!checked || loading} className="no-print h-12 w-full text-base">
        <Shield size={16} />
        {loading ? "Registrando conformidad..." : "Aceptar y continuar"}
      </Button>
    </div>
  );
}

// ─── Step 1: Face Verification (Local webcam) ───────────────────────────────────────

function FaceVerificationStep({
  requestId,
  onVerified,
  didFail,
}: {
  requestId: string;
  onVerified: (similarity: number) => void;
  didFail?: boolean;
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(didFail ? "La verificación falló o fue abandonada. Intentá de nuevo." : "");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("No pudimos acceder a tu cámara. Asegurate de dar los permisos necesarios.");
    } finally {
      setLoading(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !cameraActive) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  }

  function retake() {
    setCapturedPhoto(null);
    startCamera();
  }

  async function verifySelfie() {
    if (!capturedPhoto) return;
    setVerifying(true);
    setError("");
    try {
      const base64 = capturedPhoto.split(",")[1];
      const res = await verifyFaceLocal(requestId, base64);
      if (res.verified) {
        onVerified(res.similarity ?? 100);
      } else {
        setError(`Verificación fallida (${res.similarity}% de similitud). Asegurate de estar bien iluminado y de frente a la cámara.`);
        retake();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la verificación facial");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Verificación de identidad</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Capturá una selfie para compararla con tu DNI/KYC registrado y validar tu identidad.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-900 p-4 overflow-hidden relative min-h-[300px] text-white">
        {capturedPhoto ? (
          <img
            src={capturedPhoto}
            alt="Captura"
            className="w-full max-w-sm rounded-xl border-2 border-white/20 shadow-md"
          />
        ) : (
          <div className="relative w-full max-w-sm">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl border-2 border-white/10 scale-x-[-1]"
            />
            {!cameraActive && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 rounded-xl space-y-3 p-4 text-center">
                <Camera size={32} className="text-zinc-500" />
                <p className="text-xs text-zinc-400">La cámara está inactiva</p>
                <Button onClick={startCamera} size="sm">
                  Activar Cámara
                </Button>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/55 rounded-xl">
                <RefreshCw size={24} className="animate-spin text-white" />
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 leading-relaxed">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        {capturedPhoto ? (
          <>
            <Button
              onClick={retake}
              variant="secondary"
              disabled={verifying}
              className="flex-1 h-12"
            >
              <RefreshCw size={15} /> Volver a tomar
            </Button>
            <Button
              onClick={verifySelfie}
              disabled={verifying}
              className="flex-1 h-12"
            >
              {verifying ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  <ShieldCheck size={15} /> Confirmar y verificar
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            onClick={capturePhoto}
            disabled={!cameraActive || loading}
            className="w-full h-12 text-base"
          >
            <Camera size={16} /> Capturar Foto
          </Button>
        )}
      </div>

      <p className="text-center text-[10px] text-zinc-400">
        La selfie será procesada de forma segura mediante biometría facial comparativa · Ley 25.506
      </p>
    </div>
  );
}

// ─── Step 2: Signature Pad ────────────────────────────────────────────────────

function SignaturePadStep({ onConfirm }: { onConfirm: (dataUrl: string) => void }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const isDrawing    = useRef(false);
  const lastPos      = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  function getPos(e: PointerEvent) {
    return {
      x: e.offsetX,
      y: e.offsetY,
    };
  }

  function draw(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = "#18181b";
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastPos.current = { x, y };
    setHasStrokes(true);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Match the drawing surface exactly to the visible canvas.
    // Using devicePixelRatio here can offset strokes when the browser/layout scales the element.
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const p = getPos(e);
      lastPos.current = p;
      draw(p.x, p.y);
    };
    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const p = getPos(e);
      draw(p.x, p.y);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      isDrawing.current = false;
      lastPos.current = null;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }

  function confirmSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Dibujá tu firma</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Usá el mouse o el dedo para firmar en el recuadro. Esta firma quedará registrada en el documento.
        </p>
      </div>

      {/* Signature canvas */}
      <div className="rounded-2xl border-2 border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <PenLine size={13} />
            Área de firma
          </div>
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <Trash2 size={11} /> Limpiar
          </button>
        </div>

        <div className="relative" style={{ height: "220px" }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none"
            style={{ display: "block" }}
          />
          {!hasStrokes && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-zinc-300 select-none">Firmá aquí</p>
            </div>
          )}
          {/* Baseline */}
          <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-zinc-200" />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-500 space-y-0.5">
        <p className="font-semibold text-zinc-700">¿Por qué se pide la firma manuscrita?</p>
        <p>
          La firma digitalizada, combinada con la verificación OTP y facial, constituye una firma electrónica
          avanzada con validez legal bajo la Ley N° 25.506.
        </p>
      </div>

      <Button
        onClick={confirmSignature}
        disabled={!hasStrokes}
        className="h-12 w-full text-base"
      >
        <CheckCircle2 size={16} />
        Confirmar firma
      </Button>
    </div>
  );
}

// ─── Audit helpers ────────────────────────────────────────────────────────────

function AuditRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="w-28 shrink-0 text-zinc-400">{label}</span>
      <span className="break-all text-right font-medium text-zinc-800">{value}</span>
    </div>
  );
}

function AuditPartyCard({
  role, badgeClass, rows, signatureUrl, note,
}: {
  role: string;
  badgeClass: string;
  rows: { label: string; value: string }[];
  signatureUrl?: string | null;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
          {role}
        </span>
        {note && <span className="text-[11px] text-zinc-400">{note}</span>}
      </div>
      <div className="flex gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
        <div className="flex-1 space-y-2">
          {rows.map(({ label, value }) => (
            <AuditRow key={label} label={label} value={value} />
          ))}
        </div>
        {signatureUrl && (
          <div className="flex w-28 shrink-0 flex-col items-center justify-end gap-1">
            <img src={signatureUrl} alt="Firma" className="max-h-14 max-w-full object-contain" />
            <div className="w-full border-t border-zinc-300" />
            <p className="text-center text-[9px] text-zinc-400">Firma registrada</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadContractButton({ request }: { request: SigningRequest }) {
  const [downloading, setDownloading] = useState(false);
  const cached = loadOrgCache();

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadContractAsPdf({
        title:     request.documentTitle,
        signerName: request.signerName,
        logoUrl:   request.organizationLogo ?? cached?.logoLightUrl ?? cached?.logoDarkUrl ?? null,
        orgName:   request.organizationName ?? cached?.name ?? "Firma Electrónica",
      });
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition disabled:opacity-50"
    >
      {downloading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
      {downloading ? "Generando..." : "Descargar PDF"}
    </button>
  );
}

function DownloadAuditButton({
  request, signatureData, ipAddress, faceSimilarity, signedAt, documentHash,
}: {
  request: SigningRequest;
  signatureData: string | null;
  ipAddress: string | null;
  faceSimilarity: number | null;
  signedAt: string | null;
  documentHash: string | null;
}) {
  const [downloading, setDownloading] = useState(false);
  const cached = loadOrgCache();
  const fields = request.templateFields ?? {};

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadContractWithAuditPdf({
        title:         request.documentTitle,
        signerName:    request.signerName,
        logoUrl:       request.organizationLogo ?? cached?.logoLightUrl ?? cached?.logoDarkUrl ?? null,
        orgName:       request.organizationName ?? cached?.name ?? "Firma Electrónica",
        autorNombre:   fields.autoridad_nombre ?? "",
        autorCuil:     fields.autoridad_cuil   ?? "",
        autorEmail:    fields.autoridad_email   ?? "",
        autorSigUrl:   fields.autoridad_signature_url ?? "",
        signerEmail:   request.signerEmail,
        signerCuil:    fields.cuil_firmante ?? "",
        signerDni:     fields.dni_firmante  ?? "",
        signatureData,
        ipAddress,
        faceSimilarity,
        signedAt,
        documentHash,
      });
    } catch (err) {
      console.error("Error generando auditoría:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition disabled:opacity-50"
    >
      {downloading ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
      {downloading ? "Generando..." : "Con auditoría"}
    </button>
  );
}

function SignedContractAudit({
  request,
  signatureData,
  ipAddress,
  faceSimilarity,
  signedAt,
  documentHash,
}: {
  request: SigningRequest;
  signatureData: string | null;
  ipAddress: string | null;
  faceSimilarity: number | null;
  signedAt: string | null;
  documentHash?: string | null;
}) {
  const [auditOpen, setAuditOpen] = useState(false);
  const fields      = request.templateFields ?? {};
  const autorNombre = fields.autoridad_nombre ?? "";
  const autorCuil   = fields.autoridad_cuil   ?? "";
  const autorEmail  = fields.autoridad_email  ?? "";
  const autorSigUrl = fields.autoridad_signature_url ?? "";
  const ts          = signedAt ?? request.signedAt;

  return (
    <div className="space-y-5">
      {/* Contrato con ambas firmas */}
      {request.templateId && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
            <div className="flex items-center gap-2">
              <FileSignature size={15} className="text-zinc-400" />
              <p className="max-w-xs truncate text-sm font-semibold text-zinc-900">
                {request.documentTitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DownloadContractButton request={request} />
              <DownloadAuditButton
                request={request}
                signatureData={signatureData}
                ipAddress={ipAddress}
                faceSimilarity={faceSimilarity}
                signedAt={signedAt ?? null}
                documentHash={documentHash ?? null}
              />
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                FIRMADO
              </span>
            </div>
          </div>
          <div className="bg-zinc-50 p-3">
            <ContractDocument
              templateId={request.templateId}
              fields={fields}
              logoUrl={request.organizationLogo}
              orgName={request.organizationName}
              alumnos={[
                {
                  nombre:       fields.nombre_firmante    || request.signerName,
                  email:        fields.email_firmante     || request.signerEmail,
                  dni:          fields.dni_firmante       || "",
                  cuil:         fields.cuil_firmante      || "",
                  domicilio:    fields.domicilio_firmante || "",
                  signatureUrl: signatureData,
                },
                {
                  nombre:    fields.nombre_firmante_2    || "",
                  email:     fields.email_firmante_2     || "",
                  dni:       fields.dni_firmante_2       || "",
                  cuil:      fields.cuil_firmante_2      || "",
                  domicilio: fields.domicilio_firmante_2 || "",
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Panel de auditoría colapsable */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => setAuditOpen((o) => !o)}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-zinc-50"
        >
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-zinc-500" />
            <span className="text-sm font-bold text-zinc-900">Registro de auditoría</span>
          </div>
          <ChevronDown
            size={15}
            className={`text-zinc-400 transition-transform ${auditOpen ? "rotate-180" : ""}`}
          />
        </button>

        {auditOpen && (
          <div className="space-y-5 border-t border-zinc-100 px-5 pb-5 pt-4">
            {/* Autoridad firmante */}
            {autorNombre && (
              <AuditPartyCard
                role="Autoridad Firmante"
                badgeClass="bg-blue-50 text-blue-700"
                note="Representante legal de la organización"
                signatureUrl={autorSigUrl || null}
                rows={[
                  { label: "Nombre",    value: autorNombre },
                  ...(autorCuil  ? [{ label: "CUIL/CUIT", value: autorCuil  }] : []),
                  ...(autorEmail ? [{ label: "Email",      value: autorEmail }] : []),
                  { label: "Rol",       value: "Firma Autorizada" },
                ]}
              />
            )}

            <div className="border-t border-zinc-100" />

            {/* Firmante */}
            <AuditPartyCard
              role="Firmante"
              badgeClass="bg-emerald-50 text-emerald-700"
              signatureUrl={signatureData}
              rows={[
                { label: "Nombre",          value: request.signerName },
                { label: "Email",           value: request.signerEmail },
                ...(fields.cuil_firmante     ? [{ label: "CUIL/CUIT",      value: fields.cuil_firmante }]     : []),
                ...(fields.dni_firmante      ? [{ label: "DNI",             value: fields.dni_firmante }]      : []),
                ...(fields.domicilio_firmante ? [{ label: "Domicilio",       value: fields.domicilio_firmante }] : []),
                { label: "IP registrada",   value: ipAddress || "—" },
                { label: "Fecha y hora",    value: ts ? new Date(ts).toLocaleString("es-AR") : "—" },
                ...(faceSimilarity !== null ? [{ label: "Similitud facial", value: `${faceSimilarity}%` }] : []),
              ]}
            />

            <div className="border-t border-zinc-100" />

            {/* Proceso de firma */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Proceso de firma verificado
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {[
                  "Conformidad legal aceptada",
                  "Verificación facial completada",
                  "OTP de identidad validado",
                  "Firma manuscrita digital registrada",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Hash */}
            <div className="space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <AuditRow
                label="Hash (SHA-256)"
                value={<span className="break-all font-mono text-[10px]">{request.sha256Hash || documentHash || "—"}</span>}
              />
            </div>

            {/* Validez */}
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Firma Electrónica Válida</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-700">
                  Proceso realizado conforme a la Ley N° 25.506 de Firma Digital de la República Argentina.
                  Método: OTP + Reconocimiento facial + Firma manuscrita digital.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────

function SuccessStep({
  result,
  request,
  signatureData,
  faceSimilarity,
}: {
  result: SignatureResult;
  request: SigningRequest;
  signatureData: string;
  faceSimilarity: number | null;
}) {
  return (
    <div className="space-y-5">
      {/* Banner de éxito */}
      <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--brand-primary-soft)" }}>
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--brand-primary)" }}
        >
          <CheckCircle2 size={20} style={{ color: "var(--brand-primary-text)" }} />
        </div>
        <div>
          <p className="font-bold text-zinc-900">¡Documento firmado!</p>
          <p className="text-xs text-zinc-500">
            Tu firma quedó registrada con validez legal. Recibirás una copia por email.
          </p>
        </div>
      </div>

      <SignedContractAudit
        request={request}
        signatureData={signatureData}
        ipAddress={result.ipAddress}
        faceSimilarity={faceSimilarity}
        signedAt={result.signedAt}
        documentHash={result.documentHash}
      />

      <Link to="/dashboard">
        <Button className="h-11 w-full" variant="secondary">
          Volver al dashboard
        </Button>
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SigningFlowPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const location     = useLocation();
  const [request, setRequest]           = useState<SigningRequest | null>(null);
  const [result, setResult]             = useState<SignatureResult | null>(null);
  const [step, setStep]                 = useState<StepIndex>(0);
  const [loading, setLoading]           = useState(false);
  const [initLoading, setInitLoading]   = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [faceDidFail, setFaceDidFail]   = useState(false);
  const [faceSimilarity, setFaceSimilarity] = useState<number | null>(null);
  const [signatureData, setSignatureData]   = useState<string | null>(null);
  // For the "already signed" view — load stored signature from DB
  const [storedSigData, setStoredSigData] = useState<{
    signatureData: string | null;
    ipAddress: string | null;
    faceSimilarityScore: number | null;
    signedAt: string | null;
    documentHash: string | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    getSigningRequest(id).then((r) => {
      setRequest(r);
      setInitLoading(false);
      // Load stored signature when coming back to a signed contract
      if (r?.status === "SIGNED") {
        getMySignatureDataForRequest(r.id).then(setStoredSigData);
      }

      // Detectar retorno desde DIDIT face verification
      const params = new URLSearchParams(location.search);
      const faceVerified = params.get("face_verified");
      if (faceVerified === "ok" && r?.acceptedConformity) {
        // Verificación exitosa → saltar directo al pad de firma
        setStep(2);
        // Limpiar el param de la URL sin navegar
        navigate(`/signing/${id}`, { replace: true });
      } else if (faceVerified === "failed" || faceVerified === "pending") {
        // Verificación fallida o pendiente → mostrar step 1 con error
        setStep(1);
        setFaceDidFail(true);
        navigate(`/signing/${id}`, { replace: true });
      } else if (r?.acceptedConformity && r.status === "CONFORMITY_ACCEPTED") {
        // Conformidad ya aceptada en sesión anterior → mostrar step 1
        setStep(1);
      }
    });
  }, [id, location.search, navigate]);

  // Step 0 → 1: conformidad → verificación facial
  async function handleAcceptConformity() {
    if (!request) return;
    setLoading(true); setError(null);
    try {
      await acceptConformity(request.id, "Declaro conformidad con el documento.");
      setStep(1);
    } catch {
      setError("Error al registrar la conformidad. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Step 1 → 2: facial verificado → pad de firma
  function handleFaceVerified(similarity: number) {
    setFaceSimilarity(similarity);
    setStep(2);
  }

  // Step 2 → 3: firma confirmada → ejecutar, generar PDF si es el último, mostrar confirmación
  async function handleSignatureConfirmed(signatureDataUrl: string) {
    if (!request) return;
    setLoading(true); setError(null);
    try {
      const sig = await executeSignature(request.id, {
        userAgent:           navigator.userAgent,
        signedAt:            new Date().toISOString(),
        signatureData:       signatureDataUrl,
        faceSimilarityScore: faceSimilarity,
      });
      setSignatureData(signatureDataUrl);
      // Generar PDF con firma visual inmediata (no bloquea el flujo)
      generatePerSignerSignedPdf(request.documentId).catch(() => {});
      // Intentar generar PDF consolidado si el documento quedó COMPLETED
      // (no bloquea el flujo si falla)
      tryGenerateConsolidatedPdf(request.documentId).catch(() => {});
      setResult(sig);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la firma. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (initLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 text-sm text-zinc-400">
        Cargando solicitud de firma...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <div className="text-center space-y-4">
          <XCircle size={48} className="text-red-300 mx-auto" />
          <p className="text-lg font-semibold text-zinc-700">Solicitud no encontrada</p>
          <Link to="/dashboard"><Button variant="secondary"><ArrowLeft size={15} /> Volver</Button></Link>
        </div>
      </div>
    );
  }

  if (request.status === "SIGNED") {
    const stored = storedSigData;
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg-primary)" }}>
        <header className="border-b px-4 py-4" style={{ background: "var(--brand-bg)", color: "var(--brand-bg-text)", borderBottomColor: "var(--brand-primary)" }}>
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl transition" style={{ border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)" }}>
                <ArrowLeft size={16} />
              </Link>
              <div>
                <p className="max-w-[200px] truncate text-sm font-bold sm:max-w-xs">{request.documentTitle}</p>
                <p className="text-[11px] opacity-60">Documento firmado</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
              <CheckCircle2 size={14} /> Firmado
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8 space-y-5">
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--brand-primary-soft)" }}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--brand-primary)" }}>
              <CheckCircle2 size={20} style={{ color: "var(--brand-primary-text)" }} />
            </div>
            <div>
              <p className="font-bold text-zinc-900">Contrato firmado</p>
              <p className="text-xs text-zinc-500">
                {stored?.signedAt
                  ? `Firmado el ${new Date(stored.signedAt).toLocaleString("es-AR")}`
                  : "Tu firma quedó registrada correctamente."}
              </p>
            </div>
          </div>
          <SignedContractAudit
            request={request}
            signatureData={stored?.signatureData ?? null}
            ipAddress={stored?.ipAddress ?? null}
            faceSimilarity={stored?.faceSimilarityScore ?? null}
            signedAt={stored?.signedAt ?? null}
            documentHash={stored?.documentHash ?? null}
          />
          <Link to="/dashboard">
            <Button className="h-11 w-full" variant="secondary">
              Volver al dashboard
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  if (
    new Date(request.expiresAt) < new Date() &&
    request.status !== "REJECTED"
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100">
            <XCircle size={40} className="text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-zinc-950">Este enlace venció</h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              El plazo para firmar este documento ha expirado. Contactá al remitente
              para solicitar un nuevo enlace de firma.
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="secondary">
              <ArrowLeft size={15} /> Volver al dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  function goBack() {
    if (step > 0) setStep((s) => (s - 1) as StepIndex);
    else navigate(-1);
  }

  const orgCache = loadOrgCache();
  const printLogoUrl = orgCache?.logoLightUrl ?? orgCache?.logoDarkUrl ?? null;

  return (
    <div
      className="signing-page-bg min-h-screen"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        backgroundImage: "linear-gradient(var(--brand-primary-soft), var(--brand-primary-soft))",
      }}
    >
      {/* Header solo para impresión: logo de marca + título del documento */}
      <div className="print-only hidden border-b border-zinc-200 pb-4 mb-6">
        <div className="flex items-center justify-between">
          {printLogoUrl
            ? <img src={printLogoUrl} alt="Logo" style={{ height: 40, objectFit: "contain" }} />
            : <span className="font-bold text-lg text-zinc-900">{orgCache?.name ?? "Firma Electrónica"}</span>
          }
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-900">{request.documentTitle}</p>
            <p className="text-xs text-zinc-500">Flujo de firma seguro · Ley 25.506</p>
          </div>
        </div>
      </div>

      <header
        className="no-print border-b px-4 py-4"
        style={{
          background: "var(--brand-bg)",
          color: "var(--brand-bg-text)",
          borderBottomColor: "var(--brand-primary)",
          transition: "background 0.35s ease, color 0.35s ease",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="grid h-9 w-9 place-items-center rounded-xl transition"
              style={{ border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)" }}
              type="button"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-sm font-bold truncate max-w-[200px] sm:max-w-xs">
                {request.documentTitle}
              </p>
              <p className="text-[11px] opacity-60">Flujo de firma seguro</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Firma segura</span>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-8 ${step === 0 || step === 3 ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="no-print mb-8">
          <Stepper steps={STEPS} current={step} />
        </div>

        {error && (
          <div className="no-print mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="signing-main-card rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--brand-primary-soft)" }}>
          {step === 0 && (
            <ConformityStep request={request} onAccept={handleAcceptConformity} loading={loading} />
          )}
          {step === 1 && (
            <FaceVerificationStep
              requestId={request.id}
              onVerified={handleFaceVerified}
              didFail={faceDidFail}
            />
          )}
          {step === 2 && (
            <SignaturePadStep onConfirm={handleSignatureConfirmed} />
          )}
          {step === 3 && result && (
            <SuccessStep
              result={result}
              request={request}
              signatureData={signatureData ?? ""}
              faceSimilarity={faceSimilarity}
            />
          )}
        </div>
      </main>
    </div>
  );
}
