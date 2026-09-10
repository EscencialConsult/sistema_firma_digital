import { Lock, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";
import { updatePassword } from "../../shared/services/auth.service";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // El link del email deja una sesión de recuperación temporal al cargar la
    // página (Supabase parsea el token de la URL automáticamente). Chequeamos
    // sesión existente y además escuchamos el evento PASSWORD_RECOVERY por si
    // el parseo todavía no terminó en el primer render.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm text-zinc-500">Verificando link...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-emerald-700">Contraseña actualizada</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Ya podés iniciar sesión con tu nueva contraseña. Te redirigimos en un momento...
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-zinc-950">Este link no es válido o ya expiró</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Pedí uno nuevo desde{" "}
          <Link to="/forgot-password" className="font-semibold text-zinc-950 underline underline-offset-2">
            recuperar contraseña
          </Link>
          .
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
        <h2 className="mt-2 text-2xl font-bold text-zinc-950">Elegí tu nueva contraseña</h2>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Nueva contraseña"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock size={15} />}
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          placeholder="Repetí la contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={<Lock size={15} />}
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-600">{error}</p>
          </div>
        )}

        <Button className="mt-2 h-11 w-full" type="submit" disabled={loading}>
          <ShieldCheck size={15} />
          {loading ? "Guardando..." : "Guardar nueva contraseña"}
        </Button>
      </form>
    </div>
  );
}
