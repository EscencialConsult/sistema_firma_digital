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
      setLocalError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setLocalError("Las contraseñas no coinciden.");
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          Nuevo usuario
        </p>
        <h2 className="mt-1.5 text-2xl font-bold text-white">Crear cuenta</h2>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Nombre completo"
          type="text"
          placeholder="María González"
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
          label="Contraseña"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={15} />}
          required
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          placeholder="Repetí tu contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          icon={<Lock size={15} />}
          required
        />

        {displayError && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400">
            {displayError}
          </p>
        )}

        <Button className="h-11 w-full mt-2" type="submit" disabled={loading}>
          <ShieldCheck size={15} />
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-600">
        ¿Ya tenés cuenta?{" "}
        <Link to="/login" className="font-semibold text-white transition hover:text-zinc-200">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
