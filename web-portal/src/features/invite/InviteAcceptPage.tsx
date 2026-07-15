import { CheckCircle2, Building2, XCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  getInvitationByToken,
  acceptOrgInvitation,
  type OrgInvitation,
} from "../../shared/services/memberships.service";

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();

  const [inv, setInv]         = useState<OrgInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getInvitationByToken(token)
      .then((data) => {
        if (!data) setError("Invitación no encontrada o inválida.");
        else if (data.status === "accepted") setError("Esta invitación ya fue aceptada.");
        else if (data.status === "expired" || data.status === "cancelled")
          setError("Esta invitación expiró o fue cancelada.");
        else if (new Date(data.expiresAt) < new Date())
          setError("Esta invitación expiró.");
        else setInv(data);
      })
      .catch(() => setError("No se pudo cargar la invitación."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptOrgInvitation(token);
      await reloadUser();
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aceptar la invitación.");
    } finally { setAccepting(false); }
  }

  const primary = inv?.organization?.brandPrimary ?? "#18181b";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / ícono de org */}
        <div className="flex justify-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ background: primary }}
          >
            <Building2 size={28} className="text-white" />
          </div>
        </div>

        {accepted ? (
          /* ── Éxito ── */
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center space-y-4 shadow-sm">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
            <div>
              <h1 className="text-xl font-bold text-zinc-950">¡Acceso habilitado!</h1>
              <p className="mt-2 text-sm text-zinc-500">
                Ya sos parte de{" "}
                <span className="font-semibold">{inv?.organization?.name}</span>.
                Podés recibir y firmar contratos de esta empresa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition"
              style={{ background: primary }}
            >
              Ir a mi panel
            </button>
          </div>
        ) : error ? (
          /* ── Error ── */
          <div className="rounded-2xl border border-red-100 bg-white p-6 text-center space-y-4 shadow-sm">
            <XCircle size={36} className="mx-auto text-red-400" />
            <div>
              <h1 className="text-xl font-bold text-zinc-950">Link inválido</h1>
              <p className="mt-2 text-sm text-zinc-500">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
            >
              Ir al inicio
            </button>
          </div>
        ) : inv ? (
          /* ── Invitación válida ── */
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                Invitación de empresa
              </p>
              <h1 className="mt-2 text-2xl font-bold text-zinc-950">
                {inv.organization?.name}
              </h1>
              <p className="mt-2 text-sm leading-5 text-zinc-500">
                Fuiste invitado/a a unirte a esta organización. Al aceptar, vas a poder recibir y firmar contratos en su nombre.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Invitación para</p>
              <p className="text-sm font-semibold text-zinc-800">{inv.email}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={11} className="text-zinc-400" />
                <p className="text-[11px] text-zinc-400">
                  Vence {new Date(inv.expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                </p>
              </div>
            </div>

            {!user && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                Tenés que iniciar sesión con la cuenta <strong>{inv.email}</strong> para aceptar esta invitación.
              </p>
            )}

            {user && user.email !== inv.email && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                Esta invitación es para <strong>{inv.email}</strong>, no para tu cuenta actual ({user.email}).
              </p>
            )}

            {(!user || user.email !== inv.email) ? (
              <button
                type="button"
                onClick={() => {
                  const slug = inv.organization?.slug;
                  navigate(slug ? `/${slug}` : "/login");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
              >
                {user ? "Cerrar sesión e iniciar con la cuenta correcta" : "Iniciar sesión"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: primary }}
              >
                {accepting
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : <CheckCircle2 size={15} />}
                {accepting ? "Aceptando..." : `Aceptar e unirme a ${inv.organization?.name}`}
              </button>
            )}
          </div>
        ) : null}

      </div>
    </div>
  );
}
