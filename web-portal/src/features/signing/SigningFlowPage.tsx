import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileSignature,
  Hash,
  Shield,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
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

const STEPS = ["Conformidad legal", "Verificación OTP", "Confirmación"] as const;

// ─── Step 0: Conformity ───────────────────────────────────────────────────────

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

      {/* Document preview placeholder */}
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

      {/* Legal declaration */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
          <Shield size={16} className="text-zinc-700" />
          Declaración de conformidad legal
        </div>
        <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 leading-relaxed space-y-2">
          <p>
            Declaro que he leído y comprendido en su totalidad el documento{" "}
            <span className="font-semibold">"{request.documentTitle}"</span>, y expreso mi
            conformidad con todas las cláusulas y condiciones establecidas en el mismo.
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

      <Button
        onClick={onAccept}
        disabled={!checked || loading}
        className="h-12 w-full text-base"
      >
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
  const [error, setError] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  function handleComplete(code: string) {
    setError(false);
    onVerify(code);
  }

  const expiresAt = new Date(challenge.expiresAt);
  const minutesLeft = Math.max(
    0,
    Math.round((expiresAt.getTime() - Date.now()) / 60000)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">Verificación de identidad</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Enviamos un código de verificación de 6 dígitos a{" "}
          <span className="font-semibold text-zinc-700">{challenge.maskedEmail}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center space-y-6">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-zinc-100 mx-auto">
          <Shield size={28} className="text-zinc-700" />
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900 mb-1">
            Ingresá el código de 6 dígitos
          </p>
          <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
            <Clock size={12} />
            Expira en {minutesLeft} minuto{minutesLeft !== 1 ? "s" : ""}
          </p>
        </div>

        <OtpInput onComplete={handleComplete} disabled={loading} error={error} />

        {error && (
          <p className="text-sm font-medium text-red-600">
            Código incorrecto. Intentá de nuevo.
          </p>
        )}

        {loading && (
          <p className="text-sm text-zinc-500">Verificando código...</p>
        )}
      </div>

      {/* Dev hint */}
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
              onClick={() => {
                setResendCount((n) => n + 1);
                onResend();
              }}
              className="font-semibold text-zinc-900 hover:underline"
              type="button"
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

// ─── Step 2: Success ──────────────────────────────────────────────────────────

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
            { label: "Firmante", value: result.signerName },
            { label: "Email", value: result.signerEmail },
            { label: "IP registrada", value: result.ipAddress },
            {
              label: "Fecha y hora",
              value: new Date(result.signedAt).toLocaleString("es-AR"),
            },
            {
              label: "Hash del documento",
              value: (
                <span className="font-mono text-[11px] text-zinc-500">
                  {result.documentHash.slice(0, 32)}...
                </span>
              ),
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
        Registro de auditoría guardado con inmutabilidad garantizada
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
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [result, setResult] = useState<SignatureResult | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getSigningRequest(id).then((r) => {
      setRequest(r);
      setInitLoading(false);
    });
  }, [id]);

  async function handleAcceptConformity() {
    if (!request) return;
    setLoading(true);
    setError(null);
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

  async function handleVerifyOtp(code: string) {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await verifyOtp(request.id, code);
      if (!ok) {
        setError("Código incorrecto.");
        setLoading(false);
        return;
      }
      const sig = await executeSignature(request.id, {
        userAgent: navigator.userAgent,
        signedAt: new Date().toISOString(),
      });
      setResult(sig);
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
          <Link to="/dashboard">
            <Button variant="secondary">
              <ArrowLeft size={15} /> Volver al inicio
            </Button>
          </Link>
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
          <p className="text-sm text-zinc-500">Este documento ya fue firmado exitosamente.</p>
          <Link to="/dashboard">
            <Button variant="secondary">Volver al dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (step > 0 ? setStep((s) => (s - 1) as 0 | 1 | 2) : navigate(-1))}
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
        {/* Steps */}
        <div className="mb-8">
          <Stepper steps={STEPS} current={step} />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm">
          {step === 0 && !result && (
            <ConformityStep
              request={request}
              onAccept={handleAcceptConformity}
              loading={loading}
            />
          )}
          {step === 1 && challenge && !result && (
            <OtpStep
              challenge={challenge}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              loading={loading}
            />
          )}
          {step === 2 && result && <SuccessStep result={result} />}
        </div>
      </main>
    </div>
  );
}
