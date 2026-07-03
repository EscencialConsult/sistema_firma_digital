import { Lock, Mail, ShieldCheck, User } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";

export function RegisterPage() {
  const { signUp, error } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    if (password.length < 6) {
      setLocalError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setLocalError("Las contrasenas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await signUp({ fullName, email, password });
      navigate("/kyc");
    } catch {
      // AuthProvider exposes the user-facing error.
    } finally {
      setLoading(false);
    }
  }

  const displayError = localError || error;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
          Nueva cuenta
        </p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-950">Crear cuenta</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Completa tus datos para iniciar la verificacion de identidad.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Nombre completo"
          type="text"
          placeholder="Maria Gonzalez"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          icon={<User size={15} />}
          required
          autoComplete="name"
        />
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
          placeholder="Minimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={15} />}
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirmar contrasena"
          type="password"
          placeholder="Repeti tu contrasena"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          icon={<Lock size={15} />}
          required
          autoComplete="new-password"
        />

        {displayError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
            {displayError}
          </p>
        )}

        <Button className="mt-2 h-11 w-full" type="submit" disabled={loading}>
          <ShieldCheck size={15} />
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Ya tenes cuenta?{" "}
        <Link to="/login" className="font-semibold text-zinc-950 transition hover:text-zinc-700">
          Iniciar sesion
        </Link>
      </p>
    </div>
  );
}
