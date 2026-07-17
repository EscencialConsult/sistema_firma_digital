import { Building2, CheckCircle2, Clock, Lock, Mail, ShieldCheck, User, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { register, login as loginUser } from "../../shared/services/auth.service";
import { getOrganizationBySlug } from "../../shared/services/organizations.service";
import { getMembershipForOrg, requestOrgAccess, type OrgMembership } from "../../shared/services/memberships.service";
import { applyTheme } from "../../shared/config/theme";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

type Mode = "register" | "login";

function OrgInput({ label, value, setter, type, icon: Icon, placeholder, autocomplete, primary }: {
  label: string; value: string; setter: (v: string) => void;
  type: string; icon: React.ElementType; placeholder: string;
  autocomplete: string; primary: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ borderColor: focused ? primary : "#e4e4e7" }}
          className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none transition-colors"
        />
      </div>
    </div>
  );
}

export function JoinOrgPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();

  const [org, setOrg]               = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError]     = useState(false);
  const [mode, setMode]             = useState<Mode>("login");

  // Estado de membresía del usuario logueado en esta org
  const [membership, setMembership]           = useState<OrgMembership | undefined>(undefined);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [requestSent, setRequestSent]         = useState(false);
  const [requestLoading, setRequestLoading]   = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getOrganizationBySlug(slug)
      .then((o) => {
        if (!o) { setOrgError(true); return; }
        setOrg(o);
        localStorage.setItem("lastOrgSlug", slug);
        applyTheme({
          primary:    o.brandPrimary    ?? undefined,
          secondary:  o.brandSecondary  ?? undefined,
          accent:     o.brandAccent     ?? undefined,
          background: o.brandBackground ?? undefined,
        });
        try {
          const cached = localStorage.getItem("brand_theme");
          if (cached) localStorage.setItem(`brand_theme_${slug}`, cached);
        } catch { /* storage lleno */ }
      })
      .catch(() => setOrgError(true))
      .finally(() => setOrgLoading(false));
  }, [slug]);

  // Cuando hay usuario logueado y ya tenemos la org, verificar membresía
  useEffect(() => {
    if (!user || !org) return;
    setMembershipLoading(true);
    getMembershipForOrg(org.id)
      .then(setMembership)
      .catch(() => setMembership(undefined))
      .finally(() => setMembershipLoading(false));
  }, [user, org]);

  // Auto-redirigir solo si el usuario es miembro activo de esta org
  useEffect(() => {
    if (!user || !org || membershipLoading) return;
    if (membership?.status === "active" || user.organizationId === org.id) {
      navigate("/dashboard", { replace: true });
    }
  }, [membership, membershipLoading, user, org, navigate]);

  function switchMode(m: Mode) { setMode(m); setError(null); }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (!org) return;
    setLoading(true);
    try {
      await register({ fullName, email, password, organizationId: org.id });
      await reloadUser();
      navigate("/kyc", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta.");
    } finally { setLoading(false); }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginUser(email, password);
      await reloadUser();
      // Sin navigate inmediato — el useEffect de membresía decide si redirigir
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email o contraseña incorrectos.");
    } finally { setLoading(false); }
  }

  async function handleRequestAccess() {
    if (!org) return;
    setRequestLoading(true);
    try {
      await requestOrgAccess(org.id);
      setRequestSent(true);
      // Refrescar membresía para mostrar el estado "pending"
      const updated = await getMembershipForOrg(org.id);
      setMembership(updated);
    } catch {
      /* si ya existe membresía pending, igual mostrar como enviada */
      setRequestSent(true);
    } finally { setRequestLoading(false); }
  }

  // ── Loading ──
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
            No encontramos ninguna organización con ese código.
          </p>
          <Link to="/login" className="inline-block text-sm font-semibold text-zinc-700 hover:underline">
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  const primary = org.brandPrimary ?? org.primaryColor ?? "#6366f1";

  // ── Layout compartido: dos columnas ──
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        {/* ── Panel izquierdo: branding de la org ── */}
        <section
          className="hidden border-r border-black/10 px-10 py-10 lg:flex lg:flex-col lg:justify-between"
          style={{ background: primary }}
        >
          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden">
              <OrgLogo
                logoDarkUrl={org.logoDarkUrl}
                logoLightUrl={org.logoLightUrl}
                variant="dark"
                size={36}
              />
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-white">{org.name}</p>
              <p className="mt-1 text-xs text-white/60">Portal de firma electrónica</p>
            </div>
          </div>

          {/* Headline */}
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
              Firma electrónica segura
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white">
              Gestioná contratos, verificá identidades y firmá documentos en un solo lugar.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-white/70">
              Un portal simple para usuarios y administradores, con trazabilidad,
              verificación de identidad y PDFs firmados listos para consultar.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {["KYC", "Contratos", "Auditoría"].map((item) => (
                <div key={item} className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                  <p className="text-xs font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] font-mono text-white/40">laws.escencialconsultora.com</p>
        </section>

        {/* ── Panel derecho: form ── */}
        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">

            {/* Logo mobile */}
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: primary }}
              >
                <OrgLogo logoDarkUrl={org.logoDarkUrl} logoLightUrl={org.logoLightUrl} variant="dark" size={36} />
              </div>
              <div>
                <p className="text-sm font-bold leading-none">{org.name}</p>
                <p className="mt-1 text-xs text-zinc-500">Portal de firma electrónica</p>
              </div>
            </div>

            {/* ── Usuario ya logueado ── */}
            {user ? (
              membershipLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
                </div>
              ) : membership?.status === "active" || user.organizationId === org.id ? (
                /* ✅ Estado 1: es miembro activo de esta org */
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Bienvenido/a</p>
                    <h2 className="mt-2 text-2xl font-bold text-zinc-950">{user.fullName}</h2>
                    <p className="mt-2 text-sm text-zinc-500">Tenés acceso activo a {org.name}.</p>
                  </div>
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition"
                      style={{ background: primary }}
                    >
                      <ShieldCheck size={15} /> Ir a mi panel
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/contracts")}
                      className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
                    >
                      Ver mis contratos
                    </button>
                  </div>
                </div>
              ) : membership?.status === "pending" || requestSent ? (
                /* 🔄 Estado 2: solicitud pendiente */
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100">
                      <Clock size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">Solicitud en revisión</p>
                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        Tu solicitud para unirte a <span className="font-semibold">{org.name}</span> está pendiente de aprobación por un administrador.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50 transition"
                  >
                    Ir a mi panel principal
                  </button>
                </div>
              ) : (
                /* ❌ Estado 3: tiene cuenta pero NO es de esta org — pedir acceso */
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${primary}18` }}
                    >
                      <Building2 size={18} style={{ color: primary }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Acceso restringido</p>
                      <h2 className="mt-1 text-lg font-bold text-zinc-950">{org.name}</h2>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-600 space-y-1.5">
                    <p>Tu cuenta (<span className="font-semibold">{user.email}</span>) no tiene acceso a esta empresa.</p>
                    <p>Podés solicitar acceso — un administrador de <span className="font-semibold">{org.name}</span> lo aprobará — o pedirle a un responsable que te envíe el link de invitación de la empresa.</p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleRequestAccess}
                      disabled={requestLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-50"
                      style={{ background: primary }}
                    >
                      {requestLoading
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        : <CheckCircle2 size={15} />}
                      {requestLoading ? "Enviando..." : `Solicitar acceso a ${org.name}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard")}
                      className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
                    >
                      Volver a mi panel
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* ── Form login / registro ── */
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">

                {/* Tabs */}
                <div className="flex border-b border-zinc-100">
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className="flex-1 py-3 text-xs font-semibold transition-colors"
                      style={
                        mode === m
                          ? { color: primary, borderBottom: `2px solid ${primary}`, background: `${primary}0d` }
                          : { color: "#a1a1aa", borderBottom: "2px solid transparent" }
                      }
                    >
                      {m === "login" ? "Iniciar sesión" : "Registrarse"}
                    </button>
                  ))}
                </div>

                <div className="p-6 sm:p-8 space-y-4">
                  {/* Título del form */}
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                      {mode === "login" ? "Acceso seguro" : "Nueva cuenta"}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-zinc-950">
                      {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {mode === "login"
                        ? "Ingresá con tu cuenta para ver contratos, firmas y notificaciones."
                        : "Completá tus datos para acceder a la plataforma de " + org.name + "."}
                    </p>
                  </div>

                  {error && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
                      {error}
                    </p>
                  )}

                  {mode === "login" ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <OrgInput primary={primary} label="Email"      value={email}    setter={setEmail}    type="email"    icon={Mail} placeholder="tu@email.com"  autocomplete="email" />
                      <OrgInput primary={primary} label="Contraseña" value={password} setter={setPassword} type="password" icon={Lock} placeholder="Tu contraseña" autocomplete="current-password" />
                      <button
                        type="submit" disabled={loading}
                        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                        style={{ background: primary }}
                      >
                        <ShieldCheck size={15} />
                        {loading ? "Ingresando..." : "Entrar al portal"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <OrgInput primary={primary} label="Nombre completo"      value={fullName} setter={setFullName} type="text"     icon={User} placeholder="María González"       autocomplete="name" />
                      <OrgInput primary={primary} label="Email"                value={email}    setter={setEmail}    type="email"    icon={Mail} placeholder="tu@email.com"          autocomplete="email" />
                      <OrgInput primary={primary} label="Contraseña"           value={password} setter={setPassword} type="password" icon={Lock} placeholder="Mínimo 6 caracteres"  autocomplete="new-password" />
                      <OrgInput primary={primary} label="Confirmar contraseña" value={confirm}  setter={setConfirm}  type="password" icon={Lock} placeholder="Repetí tu contraseña" autocomplete="new-password" />
                      <button
                        type="submit" disabled={loading}
                        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                        style={{ background: primary }}
                      >
                        {loading
                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          : <ShieldCheck size={15} />}
                        {loading ? "Creando cuenta..." : "Crear cuenta"}
                      </button>
                    </form>
                  )}

                  <p className="text-center text-sm text-zinc-500 pt-1">
                    {mode === "login" ? (
                      <>¿No tenés cuenta?{" "}
                        <button type="button" onClick={() => switchMode("register")}
                          className="font-semibold transition hover:opacity-75" style={{ color: primary }}>
                          Registrarse
                        </button>
                      </>
                    ) : (
                      <>¿Ya tenés cuenta?{" "}
                        <button type="button" onClick={() => switchMode("login")}
                          className="font-semibold transition hover:opacity-75" style={{ color: primary }}>
                          Iniciar sesión
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

          </div>
        </section>

      </div>
    </div>
  );
}
