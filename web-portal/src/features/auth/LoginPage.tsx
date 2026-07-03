import { Lock, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";

export function LoginPage() {
  const { signIn, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch {
      // AuthProvider exposes the user-facing error.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          Acceso seguro
        </p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-950">Iniciar sesion</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Ingresa con tu cuenta para ver contratos, firmas y notificaciones.
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
          label="Contrasena"
          type="password"
          placeholder="Tu contrasena"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={15} />}
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <Button className="mt-2 h-11 w-full" type="submit" disabled={loading}>
          <ShieldCheck size={15} />
          {loading ? "Entrando..." : "Entrar al portal"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        No tenes cuenta?{" "}
        <Link to="/register" className="font-semibold text-zinc-950 transition hover:text-zinc-700">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
