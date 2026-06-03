import { Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";

export function LoginPage({ onCreateAccount }: { onCreateAccount?: () => void }) {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Acceso seguro</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">Iniciar sesión</h2>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide">
          Email
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus-within:border-zinc-400 transition-all font-normal normal-case">
            <Mail size={16} className="text-zinc-400" />
            <input className="w-full bg-transparent outline-none text-sm" placeholder="tu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </label>

        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wide">
          Contraseña
          <input className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-zinc-400 transition font-normal normal-case text-sm" placeholder="Tu contraseña" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>

        {error ? <p className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs text-rose-700 font-semibold">{error}</p> : null}

        <Button className="h-11 w-full mt-2" type="submit" disabled={loading}>
          <ShieldCheck size={16} /> {loading ? "Entrando..." : "Entrar al portal"}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-zinc-500">
        ¿No tenés cuenta?{" "}
        <button className="font-bold text-zinc-950 hover:underline" type="button" onClick={onCreateAccount}>
          Crear cuenta
        </button>
      </p>
    </div>
  );
}
