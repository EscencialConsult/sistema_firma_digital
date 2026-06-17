import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  FileSignature,
  Hash,
  PenLine,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { OtpInput } from "../../shared/components/ui/OtpInput";
import { Stepper } from "../../shared/components/ui/Stepper";
import {
  acceptConformity,
  executeSignature,
  getSigningRequest,
  requestOtp,
  verifyOtp,
} from "../../shared/services/signing.service";
import type { OtpChallenge, SignatureResult, SigningRequest } from "../../shared/types/signing";

type StepIndex = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  "Conformidad legal",
  "Código OTP",
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
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <FileSignature size={16} className="text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-900">{request.documentTitle}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Hash size={11} />
            <span className="font-mono">{request.sha256Hash.slice(0, 16)}...</span>
          </div>
        </div>
        <div className="flex h-48 flex-col items-center justify-center text-center px-6">
          <FileSignature size={32} className="text-zinc-300 mb-2" />
          <p className="text-sm font-medium text-zinc-400">Vista previa del documento</p>
          <p className="text-xs text-zinc-400 mt-1">
            El PDF estará disponible cuando se conecte Supabase Storage
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
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
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span className="text-sm text-zinc-700">
            <span className="font-semibold">Confirmo que leí y acepto</span> la declaración de
            conformidad legal y los términos del documento descripto.
          </span>
        </label>
      </div>

      <Button onClick={onAccept} disabled={!checked || loading} className="h-12 w-full text-base">
        <Shield size={16} />
        {loading ? "Registrando conformidad..." : "Aceptar y continuar"}
      </Button>
    </div>
  );
}

// ─── Step 1: OTP ──────────────────────────────────────────────────────────────

function OtpStep({
  challenge,
  onVerify,
  onResend,
  loading,
}: {
  challenge: OtpChallenge;
  onVerify: (code: string) => void;
  onResend: () => void;
  loading: boolean;
}) {
  const [resendCount, setResendCount] = useState(0);
  const expiresAt = new Date(challenge.expiresAt);
  const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Verificación de identidad</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enviamos un código de 6 dígitos a{" "}
          <span className="font-semibold text-zinc-700">{challenge.maskedEmail}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center space-y-6">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-zinc-100 mx-auto">
          <Shield size={28} className="text-zinc-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 mb-1">Ingresá el código de 6 dígitos</p>
          <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
            <Clock size={12} />
            Expira en {minutesLeft} minuto{minutesLeft !== 1 ? "s" : ""}
          </p>
        </div>
        <OtpInput onComplete={onVerify} disabled={loading} error={false} />
        {loading && <p className="text-sm text-zinc-500">Verificando código...</p>}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
        <p className="text-xs text-amber-700 font-medium">
          Modo prueba — código válido:{" "}
          <span className="font-mono font-bold tracking-widest">123456</span>
        </p>
      </div>

      <div className="text-center">
        <p className="text-xs text-zinc-500">
          ¿No recibiste el código?{" "}
          {resendCount < 3 ? (
            <button
              type="button"
              onClick={() => { setResendCount((n) => n + 1); onResend(); }}
              className="font-semibold text-zinc-900 hover:underline"
            >
              Reenviar
            </button>
          ) : (
            <span className="text-zinc-400">Límite de reenvíos alcanzado</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: Face Verification ────────────────────────────────────────────────

type FaceState = "idle" | "streaming" | "captured" | "verifying" | "verified" | "failed";

function FaceVerificationStep({ onVerified }: { onVerified: () => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const [faceState, setFaceState] = useState<FaceState>("idle");
  const [similarity, setSimilarity] = useState(0);
  const [cameraError, setCameraError] = useState(false);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setCameraError(false);
    setFaceState("streaming");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraError(true);
      setFaceState("idle");
    }
  }

  function capturePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 480;
    canvas.height = video.videoHeight || 360;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopStream();
    setFaceState("captured");
  }

  async function runVerification() {
    setFaceState("verifying");
    // TODO:REKOGNITION — Replace with real AWS Rekognition CompareFaces call via Edge Function
    await new Promise((r) => setTimeout(r, 2200));
    const mockScore = 94.3 + Math.random() * 3;
    setSimilarity(parseFloat(mockScore.toFixed(1)));
    setFaceState(mockScore >= 90 ? "verified" : "failed");
  }

  function reset() {
    setFaceState("idle");
    setSimilarity(0);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => () => stopStream(), []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Verificación facial</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tomate una selfie para confirmar tu identidad. Asegurate de tener buena iluminación.
        </p>
      </div>

      {/* Camera / capture area */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 overflow-hidden aspect-[4/3] relative flex items-center justify-center">
        {/* Video stream */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${faceState === "streaming" ? "opacity-100" : "opacity-0"}`}
          muted
          playsInline
        />

        {/* Captured photo */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${["captured","verifying","verified","failed"].includes(faceState) ? "opacity-100" : "opacity-0"}`}
        />

        {/* Face guide overlay on streaming */}
        {faceState === "streaming" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full border-4 border-white/60 w-48 h-48 sm:w-64 sm:h-64" />
          </div>
        )}

        {/* Idle state */}
        {faceState === "idle" && (
          <div className="text-center space-y-3 px-6">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-zinc-800 mx-auto">
              <Camera size={28} className="text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-400">La cámara se activará al hacer click en "Abrir cámara"</p>
          </div>
        )}

        {/* Verifying overlay */}
        {faceState === "verifying" && (
          <div className="absolute inset-0 bg-zinc-950/80 flex flex-col items-center justify-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-900/50 border border-blue-700">
              <Shield size={24} className="text-blue-400 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-white">Verificando identidad...</p>
            <p className="text-xs text-zinc-400">Comparando con tu documento KYC</p>
          </div>
        )}

        {/* Verified overlay */}
        {faceState === "verified" && (
          <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-900/50 border border-emerald-600">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">Identidad verificada</p>
            <p className="text-xs text-emerald-300 font-mono">
              Similitud: {similarity}% — por encima del umbral (90%)
            </p>
          </div>
        )}

        {/* Failed overlay */}
        {faceState === "failed" && (
          <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center gap-3">
            <XCircle size={32} className="text-red-400" />
            <p className="text-sm font-bold text-white">No coincide</p>
            <p className="text-xs text-red-300">Similitud {similarity}% — por debajo del umbral</p>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          No se pudo acceder a la cámara. Verificá los permisos del navegador.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {faceState === "idle" && (
          <Button onClick={startCamera} className="h-12 w-full text-base">
            <Camera size={16} /> Abrir cámara
          </Button>
        )}

        {faceState === "streaming" && (
          <Button onClick={capturePhoto} className="h-12 w-full text-base bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50">
            <Camera size={16} /> Capturar foto
          </Button>
        )}

        {faceState === "captured" && (
          <div className="flex gap-3">
            <Button onClick={reset} variant="secondary" className="h-11 flex-1 text-zinc-600">
              <RefreshCw size={15} /> Repetir
            </Button>
            <Button onClick={runVerification} className="h-11 flex-1">
              <Shield size={15} /> Verificar identidad
            </Button>
          </div>
        )}

        {faceState === "failed" && (
          <Button onClick={reset} variant="secondary" className="h-11 w-full text-zinc-700">
            <RefreshCw size={15} /> Intentar de nuevo
          </Button>
        )}

        {faceState === "verified" && (
          <Button onClick={onVerified} className="h-12 w-full text-base bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 size={16} /> Continuar a firma
          </Button>
        )}
      </div>

      <p className="text-center text-[11px] text-zinc-400">
        La imagen se procesa de forma segura y no se almacena. · TODO:REKOGNITION
      </p>
    </div>
  );
}

// ─── Step 3: Signature Pad ────────────────────────────────────────────────────

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

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function SuccessStep({ result }: { result: SignatureResult }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100">
          <CheckCircle2 size={40} className="text-emerald-600" />
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

      <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
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
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const [request, setRequest]       = useState<SigningRequest | null>(null);
  const [challenge, setChallenge]   = useState<OtpChallenge | null>(null);
  const [result, setResult]         = useState<SignatureResult | null>(null);
  const [step, setStep]             = useState<StepIndex>(0);
  const [loading, setLoading]       = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getSigningRequest(id).then((r) => { setRequest(r); setInitLoading(false); });
  }, [id]);

  // Step 0 → 1
  async function handleAcceptConformity() {
    if (!request) return;
    setLoading(true); setError(null);
    try {
      await acceptConformity(request.id, "Declaro conformidad con el documento.");
      const ch = await requestOtp(request.id, user?.email ?? "");
      setChallenge(ch);
      setStep(1);
    } catch {
      setError("Error al registrar la conformidad. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Step 1 → 2
  async function handleVerifyOtp(code: string) {
    if (!request) return;
    setLoading(true); setError(null);
    try {
      const ok = await verifyOtp(request.id, code);
      if (!ok) { setError("Código incorrecto."); setLoading(false); return; }
      setStep(2);
    } catch {
      setError("Error al verificar el código. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!request) return;
    const ch = await requestOtp(request.id, user?.email ?? "");
    setChallenge(ch);
  }

  // Step 2 → 3
  function handleFaceVerified() {
    setStep(3);
  }

  // Step 3 → 4
  async function handleSignatureConfirmed(signatureDataUrl: string) {
    if (!request) return;
    setLoading(true); setError(null);
    try {
      const sig = await executeSignature(request.id, {
        userAgent:     navigator.userAgent,
        signedAt:      new Date().toISOString(),
        signatureData: signatureDataUrl,
      });
      setResult(sig);
      setStep(4);
    } catch {
      setError("Error al registrar la firma. Intentá de nuevo.");
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

  function goBack() {
    if (step > 0) setStep((s) => (s - 1) as StepIndex);
    else navigate(-1);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
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
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Firma segura</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <Stepper steps={STEPS} current={step} />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm">
          {step === 0 && (
            <ConformityStep request={request} onAccept={handleAcceptConformity} loading={loading} />
          )}
          {step === 1 && challenge && (
            <OtpStep challenge={challenge} onVerify={handleVerifyOtp} onResend={handleResendOtp} loading={loading} />
          )}
          {step === 2 && (
            <FaceVerificationStep onVerified={handleFaceVerified} />
          )}
          {step === 3 && (
            <SignaturePadStep onConfirm={handleSignatureConfirmed} />
          )}
          {step === 4 && result && (
            <SuccessStep result={result} />
          )}
        </div>
      </main>
    </div>
  );
}
