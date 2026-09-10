import { Mail, MailCheck, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../shared/services/auth.service";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el email.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-2 flex items-center gap-2 text-emerald-700">
          <MailCheck size={18} />
          <p className="text-sm font-semibold">Revisá tu correo</p>
        </div>
        <p className="text-sm leading-6 text-zinc-500">
          Si <strong>{email}</strong> tiene una cuenta en el sistema, te enviamos un link para
          restablecer tu contraseña. Puede tardar unos minutos en llegar.
        </p>
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link to="/login" className="font-semibold text-zinc-950 transition hover:text-zinc-700">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          Recuperar acceso
        </p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-950">¿Olvidaste tu contraseña?</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Ingresá tu email y te mandamos un link para elegir una contraseña nueva.
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-600">{error}</p>
          </div>
        )}

        <Button className="mt-2 h-11 w-full" type="submit" disabled={loading || !email}>
          <ShieldCheck size={15} />
          {loading ? "Enviando..." : "Enviar link de recuperación"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link to="/login" className="font-semibold text-zinc-950 transition hover:text-zinc-700">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
