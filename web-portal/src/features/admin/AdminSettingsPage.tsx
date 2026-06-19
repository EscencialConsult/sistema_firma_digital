import {
  CheckCircle2,
  Copy,
  Loader2,
  PenLine,
  PlusCircle,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getMyOrganization, updateOrganization } from "../../shared/services/organizations.service";
import {
  getOrgAuthorities,
  inviteAuthority,
  revokeAuthority,
  buildInviteUrl,
  type OrgAuthority,
  type AuthorityType,
} from "../../shared/services/authorities.service";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

const TYPE_LABEL: Record<AuthorityType, string> = {
  PERMANENT:   "Permanente",
  PROVISIONAL: "Provisional",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  ACTIVE:   "bg-emerald-100 text-emerald-700",
  REVOKED:  "bg-red-100 text-red-600",
  EXPIRED:  "bg-zinc-100 text-zinc-500",
};

// ─── Modal: invitar nueva autoridad ───────────────────────────────────────────

function InviteModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: (a: OrgAuthority) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [cuil, setCuil]         = useState("");
  const [type, setType]         = useState<AuthorityType>("PERMANENT");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [created, setCreated]   = useState<OrgAuthority | null>(null);
  const [copied, setCopied]     = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const a = await inviteAuthority({
        organizationId: orgId,
        fullName: fullName.trim(),
        email: email.trim(),
        cuil: cuil.trim() || undefined,
        type,
        notes: notes.trim() || undefined,
      });
      setCreated(a);
      onCreated(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al invitar");
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!created?.inviteToken) return;
    navigator.clipboard.writeText(buildInviteUrl(created.inviteToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <p className="font-semibold text-zinc-900">Invitar autoridad firmante</p>
          <button onClick={onClose} type="button" className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>

        {/* ── Estado: link generado ── */}
        {created ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-zinc-900">Invitación creada</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Compartí este link con <strong>{created.fullName}</strong> para que acepte su rol.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-semibold text-zinc-400 mb-1.5">Link de invitación</p>
              <p className="break-all text-xs text-zinc-700 font-mono">
                {created.inviteToken ? buildInviteUrl(created.inviteToken) : "Generando..."}
              </p>
            </div>

            <button
              onClick={handleCopy}
              type="button"
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-900 text-white hover:bg-zinc-700"
              }`}
            >
              {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              {copied ? "¡Copiado!" : "Copiar link"}
            </button>

            <p className="text-center text-xs text-zinc-400">
              {created.type === "PERMANENT"
                ? "Al abrir el link, la autoridad podrá cargar su firma y activar su acceso."
                : "Al abrir el link, la autoridad aceptará el rol provisional."}
            </p>
          </div>
        ) : (
          /* ── Formulario ── */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Nombre completo *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: María García"
                required
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="autoridad@empresa.com"
                required
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">CUIL</label>
              <input
                value={cuil}
                onChange={(e) => setCuil(e.target.value)}
                placeholder="20-12345678-9"
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Tipo de autoridad</label>
              <div className="grid grid-cols-2 gap-2">
                {(["PERMANENT", "PROVISIONAL"] as AuthorityType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      type === t
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                {type === "PERMANENT"
                  ? "Habilitada indefinidamente. Su firma quedará guardada y disponible para todos los contratos."
                  : "Habilitada para un convenio puntual. Le llegará el contrato vacío para que firme."}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Notas internas</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Directora comercial — convenio OSPA 2026"
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>

            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>
            )}

            <button
              type="submit"
              disabled={saving || !fullName.trim() || !email.trim()}
              className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin inline mr-1" /> : null}
              {saving ? "Creando invitación..." : "Crear invitación"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const [org, setOrg]                   = useState<Organization | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [authorities, setAuthorities]   = useState<OrgAuthority[]>([]);
  const [authLoading, setAuthLoading]   = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [revoking, setRevoking]         = useState<string | null>(null);

  useEffect(() => {
    getMyOrganization()
      .then((o) => {
        setOrg(o);
        if (o) {
          setContactEmail(o.contactEmail ?? "");
          getOrgAuthorities(o.id)
            .then(setAuthorities)
            .catch(() => setAuthorities([]))
            .finally(() => setAuthLoading(false));
        } else {
          setAuthLoading(false);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateOrganization(org.id, { contactEmail: contactEmail.trim() || undefined });
      setOrg({ ...org, contactEmail: contactEmail.trim() || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await revokeAuthority(id);
      setAuthorities((prev) => prev.map((a) => a.id === id ? { ...a, status: "REVOKED" } : a));
    } catch {
      // silencioso — el botón vuelve a su estado
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Loader2 size={22} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? "No se encontró la organización. Contactá al soporte de Escencial."}
      </div>
    );
  }

  const permanents   = authorities.filter((a) => a.type === "PERMANENT");
  const provisionals = authorities.filter((a) => a.type === "PROVISIONAL");

  return (
    <>
      {showModal && org && (
        <InviteModal
          orgId={org.id}
          onClose={() => setShowModal(false)}
          onCreated={(a) => {
            setAuthorities((prev) => [a, ...prev]);
            setShowModal(false);
          }}
        />
      )}

      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Configuración</h1>
          <p className="mt-1 text-sm text-zinc-500">Personalizá tu organización en la plataforma.</p>
        </div>

        {/* Info de solo lectura */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Tu organización</p>
          <div className="flex items-center gap-4">
            <OrgLogo logoDarkUrl={org.logoDarkUrl} logoLightUrl={org.logoLightUrl} variant="light" size={52} />
            <div>
              <p className="font-semibold text-zinc-900">{org.name}</p>
              <p className="text-xs text-zinc-500">/{org.slug}</p>
              <span className="mt-1 inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
                {org.maxUsers} usuarios máx.
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        {saved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            ✓ Cambios guardados correctamente
          </div>
        )}

        {/* Email de contacto */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Datos de contacto</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Email de contacto</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="admin@empresa.com"
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-zinc-200 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>

        {/* ─── Autoridades firmantes ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-zinc-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-zinc-500" />
                Autoridades firmantes
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Personas habilitadas para firmar contratos en nombre de tu organización.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              <PlusCircle size={14} />
              Invitar autoridad
            </button>
          </div>

          {authLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 size={18} className="animate-spin text-zinc-400" />
            </div>
          ) : authorities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-8 text-center">
              <UserCheck size={28} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-500">Sin autoridades configuradas</p>
              <p className="mt-1 text-xs text-zinc-400">
                Invitá una autoridad para poder emitir contratos con firma válida.
              </p>
            </div>
          ) : (
            <>
              {/* Permanentes */}
              {permanents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Permanentes</p>
                  {permanents.map((a) => (
                    <AuthorityRow key={a.id} authority={a} onRevoke={handleRevoke} revoking={revoking} />
                  ))}
                </div>
              )}
              {/* Provisionales */}
              {provisionals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Provisionales</p>
                  {provisionals.map((a) => (
                    <AuthorityRow key={a.id} authority={a} onRevoke={handleRevoke} revoking={revoking} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function AuthorityRow({
  authority: a,
  onRevoke,
  revoking,
}: {
  authority: OrgAuthority;
  onRevoke: (id: string) => void;
  revoking: string | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100">
          {a.signatureUrl ? (
            <img src={a.signatureUrl} alt="firma" className="h-7 w-7 object-contain" />
          ) : (
            <PenLine size={16} className="text-zinc-400" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">{a.fullName}</p>
            {a.status === "ACTIVE" && <CheckCircle2 size={13} className="text-emerald-500" />}
          </div>
          <p className="text-xs text-zinc-500">{a.email}{a.cuil ? ` · CUIL ${a.cuil}` : ""}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[a.status] ?? "bg-zinc-100 text-zinc-500"}`}>
          {a.status === "PENDING" ? "Pendiente" : a.status === "ACTIVE" ? "Activa" : a.status === "REVOKED" ? "Revocada" : "Expirada"}
        </span>
        {a.status !== "REVOKED" && a.status !== "EXPIRED" && (
          <button
            onClick={() => onRevoke(a.id)}
            disabled={revoking === a.id}
            type="button"
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-500 transition"
            title="Revocar"
          >
            {revoking === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
