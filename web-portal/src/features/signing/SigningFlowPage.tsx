import {
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  Hash,
  Printer,
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
import { Button } from "../../shared/components/ui/Button";
import { Stepper } from "../../shared/components/ui/Stepper";
import {
  acceptConformity,
  executeSignature,
  getSigningRequest,
  tryGenerateConsolidatedPdf,
  verifyFaceLocal,
} from "../../shared/services/signing.service";
import type { SignatureResult, SigningRequest } from "../../shared/types/signing";

type StepIndex = 0 | 1 | 2 | 3;

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Declaración de conformidad</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Leé el documento y la declaración antes de continuar.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden">
        {/* Header */}
        <div className="no-print flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <FileSignature size={16} className="text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-900">{request.documentTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {request.sha256Hash && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Hash size={11} />
                <span className="font-mono">{request.sha256Hash.slice(0, 16)}...</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-50 transition"
            >
              <Printer size={11} /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Contract content — rendered from template or placeholder */}
        {request.templateId && request.templateFields ? (
          <div className="p-3">
            <ContractDocument
              templateId={request.templateId}
              fields={request.templateFields}
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
  onVerified: () => void;
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
        onVerified();
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

  function getPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
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

    // Size canvas to display size
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Mouse
    const onMouseDown = (e: MouseEvent) => { isDrawing.current = true; lastPos.current = getPos(e, canvas); };
    const onMouseMove = (e: MouseEvent) => { const p = getPos(e, canvas); draw(p.x, p.y); };
    const onMouseUp   = () => { isDrawing.current = false; lastPos.current = null; };

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      lastPos.current = getPos(e.touches[0], canvas);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const p = getPos(e.touches[0], canvas);
      draw(p.x, p.y);
    };
    const onTouchEnd = () => { isDrawing.current = false; lastPos.current = null; };

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
    canvas.addEventListener("touchend",   onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchend",   onTouchEnd);
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

// ─── Step 3: Success ──────────────────────────────────────────────────────────

function SuccessStep({ result }: { result: SignatureResult }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-full" style={{ background: "var(--brand-primary-soft)" }}>
          <CheckCircle2 size={40} style={{ color: "var(--brand-primary)" }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-950">¡Documento firmado!</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Tu firma quedó registrada con validez legal. Recibirás una copia por email.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-left space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Registro de firma</p>
        <div className="space-y-2 text-sm">
          {[
            { label: "Firmante",        value: result.signerName },
            { label: "Email",           value: result.signerEmail },
            { label: "IP registrada",   value: result.ipAddress },
            { label: "Fecha y hora",    value: new Date(result.signedAt).toLocaleString("es-AR") },
            {
              label: "Hash documento",
              value: <span className="font-mono text-[11px] text-zinc-500">{result.documentHash.slice(0, 32)}...</span>,
            },
            {
              label: "ID de firma",
              value: <span className="font-mono text-[11px] text-zinc-500">{result.signatureId}</span>,
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <span className="shrink-0 text-xs text-zinc-400">{label}</span>
              <span className="font-medium text-zinc-900 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold" style={{ borderColor: "var(--brand-primary-soft)", background: "var(--brand-primary-soft)", color: "var(--brand-primary)" }}>
        <ShieldCheck size={14} />
        Firma verificada · OTP + Reconocimiento facial + Firma manuscrita
      </div>

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
  const [request, setRequest]         = useState<SigningRequest | null>(null);
  const [result, setResult]           = useState<SignatureResult | null>(null);
  const [step, setStep]               = useState<StepIndex>(0);
  const [loading, setLoading]         = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [faceDidFail, setFaceDidFail] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSigningRequest(id).then((r) => {
      setRequest(r);
      setInitLoading(false);

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
  function handleFaceVerified() {
    setStep(2);
  }

  // Step 2 → 3: firma confirmada → ejecutar, generar PDF si es el último, mostrar confirmación
  async function handleSignatureConfirmed(signatureDataUrl: string) {
    if (!request) return;
    setLoading(true); setError(null);
    try {
      const sig = await executeSignature(request.id, {
        userAgent:     navigator.userAgent,
        signedAt:      new Date().toISOString(),
        signatureData: signatureDataUrl,
      });
      // Intentar generar PDF consolidado si el documento quedó COMPLETED
      // (no bloquea el flujo si falla)
      tryGenerateConsolidatedPdf(request.documentId);
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
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
          <p className="text-xl font-bold text-zinc-950">Ya firmaste este documento</p>
          <Link to="/dashboard"><Button variant="secondary">Volver al dashboard</Button></Link>
        </div>
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

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        backgroundImage: "linear-gradient(var(--brand-primary-soft), var(--brand-primary-soft))",
      }}
    >
      <header
        className="no-print border-b bg-white px-4 py-4"
        style={{ borderBottomColor: "var(--brand-primary)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition"
              type="button"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-sm font-bold text-zinc-950 truncate max-w-[200px] sm:max-w-xs">
                {request.documentTitle}
              </p>
              <p className="text-[11px] text-zinc-500">Flujo de firma seguro</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--brand-primary)" }}>
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Firma segura</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="no-print mb-8">
          <Stepper steps={STEPS} current={step} />
        </div>

        {error && (
          <div className="no-print mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--brand-primary-soft)" }}>
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
            <SuccessStep result={result} />
          )}
        </div>
      </main>
    </div>
  );
}
