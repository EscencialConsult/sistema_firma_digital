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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          Acceso seguro
        </p>
        <h2 className="mt-1.5 text-2xl font-bold text-white">Iniciar sesión</h2>
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
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400">
            {error}
          </p>
        )}

        <Button className="h-11 w-full mt-2" type="submit" disabled={loading}>
          <ShieldCheck size={15} />
          {loading ? "Entrando..." : "Entrar al portal"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-600">
        ¿No tenés cuenta?{" "}
        <Link to="/register" className="font-semibold text-white transition hover:text-zinc-200">
          Crear cuenta
        </Link>
      </p>

      {/* Dev hint */}
      <details className="mt-6">
        <summary className="cursor-pointer text-[11px] text-zinc-700 hover:text-zinc-500 transition select-none">
          Credenciales de prueba
        </summary>
        <div className="mt-2 space-y-1 rounded-xl border border-white/5 bg-white/5 p-3 font-mono text-[11px] text-zinc-500">
          <p>admin@escencial.com · Admin123456</p>
          <p>alumno@gmail.com · Alumno123 (verificado)</p>
          <p>nuevo@gmail.com · Nuevo123 (pendiente KYC)</p>
          <p>revision@gmail.com · Review123 (en revisión)</p>
          <p>rechazado@gmail.com · Rejected123 (rechazado)</p>
        </div>
      </details>
    </div>
  );
}
