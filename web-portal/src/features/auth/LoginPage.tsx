import { Lock, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { resendConfirmationEmail } from "../../shared/services/auth.service";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";

export function LoginPage() {
  const { signIn, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResendState("idle");
    try {
      await signIn(email, password);
      navigate("/");
    } catch {
      // AuthProvider exposes the user-facing error.
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email || resendState !== "idle") return;
    setResendState("sending");
    try {
      await resendConfirmationEmail(email);
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          Acceso seguro
        </p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-950">Iniciar sesión</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Ingresá con tu cuenta para ver contratos, firmas y notificaciones.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail size={15} />}
          required
          autoComplete="email"
        />
        <Input
          label="Contraseña"
          type="password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={15} />}
          required
          autoComplete="current-password"
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-xs font-medium text-red-600">{error}</p>
            {resendState === "sent" ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <MailCheck size={13} /> Email de confirmación reenviado. Revisá tu casilla.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={!email || resendState === "sending"}
                className="text-xs text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
              >
                {resendState === "sending" ? "Enviando…" : "¿No confirmaste tu email? Reenviar verificación"}
              </button>
            )}
          </div>
        )}

        <Button className="mt-2 h-11 w-full" type="submit" disabled={loading}>
          <ShieldCheck size={15} />
          {loading ? "Entrando..." : "Entrar al portal"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        ¿No tenés cuenta?{" "}
        <Link to="/register" className="font-semibold text-zinc-950 transition hover:text-zinc-700">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
