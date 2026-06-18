import { Lock, Mail, ShieldCheck, User, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { register } from "../../shared/services/auth.service";
import { getOrganizationBySlug } from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

export function JoinOrgPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg]           = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState(false);

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);

  // Si ya está logueado, redirigir al dashboard
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!slug) return;
    getOrganizationBySlug(slug)
      .then((o) => { if (!o) setOrgError(true); else setOrg(o); })
      .catch(() => setOrgError(true))
      .finally(() => setOrgLoading(false));
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (!org) return;

    setLoading(true);
    try {
      await register({ fullName, email, password, organizationId: org.id });
      await reloadUser();
      setDone(true);
      navigate("/kyc", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  // ── Loading org ──
  if (orgLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
      </div>
    );
  }

  // ── Org no encontrada ──
  if (orgError || !org) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-red-100">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Link inválido</h1>
          <p className="text-sm text-zinc-500">
            No encontramos ninguna organización con ese código. Pedile a tu empresa que te comparta el link correcto.
          </p>
          <Link to="/login" className="inline-block text-sm font-semibold text-zinc-700 hover:underline">
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // ── Registro exitoso (en transición a /kyc) ──
  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Branding de la org */}
        <div className="flex flex-col items-center gap-3 text-center">
          <OrgLogo
            logoDarkUrl={org.logoDarkUrl}
            logoLightUrl={org.logoLightUrl}
            variant="light"
            size={64}
          />
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{org.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">Creá tu cuenta para acceder a la plataforma</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Nombre completo", value: fullName, setter: setFullName, type: "text",     icon: User,        placeholder: "María González",     autocomplete: "name" },
              { label: "Email",           value: email,    setter: setEmail,    type: "email",    icon: Mail,        placeholder: "tu@email.com",        autocomplete: "email" },
              { label: "Contraseña",      value: password, setter: setPassword, type: "password", icon: Lock,        placeholder: "Mínimo 6 caracteres", autocomplete: "new-password" },
              { label: "Confirmar contraseña", value: confirm, setter: setConfirm, type: "password", icon: Lock, placeholder: "Repetí tu contraseña", autocomplete: "new-password" },
            ].map(({ label, value, setter, type, icon: Icon, placeholder, autocomplete }) => (
              <div key={label}>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-500">{label}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Icon size={14} />
                  </span>
                  <input
                    type={type}
                    required
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autocomplete}
                    className="w-full rounded-xl border border-zinc-200 py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition disabled:opacity-50 mt-2"
            >
              {loading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : <ShieldCheck size={15} />}
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-400">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-semibold text-zinc-700 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
