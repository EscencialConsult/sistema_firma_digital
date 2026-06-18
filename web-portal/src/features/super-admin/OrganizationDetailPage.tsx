import {
  ArrowLeft,
  CheckCircle,
  ClipboardList,
  Clock,
  Copy,
  Loader2,
  Pencil,
  Save,
  Users,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getOrganization,
  getOrganizationStats,
  updateOrganization,
  uploadOrgLogo,
} from "../../shared/services/organizations.service";
import type { Organization, OrganizationStats } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";


function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className={`mb-3 inline-grid h-9 w-9 place-items-center rounded-xl ${color}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg]       = useState<Organization | null>(null);
  const [stats, setStats]   = useState<OrganizationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  function copyId() {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // edit fields
  const [name, setName]               = useState("");
  const [diditWorkflowId, setDiditWorkflowId] = useState("");
  const [maxUsers, setMaxUsers]       = useState(50);
  const [contactEmail, setContactEmail] = useState("");
  const [logoDark, setLogoDark]       = useState<File | null>(null);
  const [logoLight, setLogoLight]     = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getOrganization(id), getOrganizationStats(id)])
      .then(([o, s]) => {
        setOrg(o);
        setStats(s);
        if (o) {
          setName(o.name);
          setDiditWorkflowId(o.diditWorkflowId ?? "");
          setMaxUsers(o.maxUsers);
          setContactEmail(o.contactEmail ?? "");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!org || !id) return;
    setSaving(true);
    setError(null);
    try {
      let logoDarkUrl  = org.logoDarkUrl;
      let logoLightUrl = org.logoLightUrl;
      if (logoDark)  logoDarkUrl  = await uploadOrgLogo(id, logoDark,  "dark");
      if (logoLight) logoLightUrl = await uploadOrgLogo(id, logoLight, "light");

      await updateOrganization(id, {
        name: name.trim(),
        diditWorkflowId: diditWorkflowId.trim() || undefined,
        maxUsers,
        contactEmail: contactEmail.trim() || undefined,
        logoDarkUrl:  logoDarkUrl  ?? null,
        logoLightUrl: logoLightUrl ?? null,
      });

      setOrg({ ...org, name: name.trim(), diditWorkflowId: diditWorkflowId.trim() || undefined, maxUsers, contactEmail: contactEmail.trim() || undefined, logoDarkUrl, logoLightUrl });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!org || !id) return;
    await updateOrganization(id, { isActive: !org.isActive });
    setOrg({ ...org, isActive: !org.isActive });
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <Link to="/super-admin/organizations" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition">
          <ArrowLeft size={14} /> Volver
        </Link>
        <p className="text-sm text-red-400">{error ?? "Organización no encontrada."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/super-admin/organizations"
          className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-500 hover:bg-zinc-800 transition"
        >
          <ArrowLeft size={16} />
        </Link>
        <OrgLogo logoDarkUrl={org.logoDarkUrl} logoLightUrl={org.logoLightUrl} variant="dark" size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{org.name}</h1>
            {org.isActive ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                <CheckCircle size={12} /> Activa
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-red-400">
                <XCircle size={12} /> Inactiva
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">/{org.slug}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleActive}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              org.isActive
                ? "border-red-800 text-red-400 hover:bg-red-950/40"
                : "border-emerald-800 text-emerald-400 hover:bg-emerald-950/40"
            }`}
          >
            {org.isActive ? "Desactivar" : "Activar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
          >
            <Pencil size={13} />
            {editing ? "Cancelar" : "Editar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Usuarios totales"  value={stats.totalUsers}    icon={Users}         color="text-blue-400 bg-blue-950/60" />
          <StatCard label="Verificados"       value={stats.verifiedUsers} icon={CheckCircle}   color="text-emerald-400 bg-emerald-950/60" />
          <StatCard label="KYC pendientes"    value={stats.pendingKycs}   icon={Clock}         color="text-amber-400 bg-amber-950/60" />
          <StatCard label="Contratos"         value={stats.totalContracts}icon={ClipboardList} color="text-violet-400 bg-violet-950/60" />
        </div>
      )}

      {/* ID de organización */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-0.5">ID de organización</p>
          <p className="text-xs font-mono text-zinc-300 truncate">{id}</p>
        </div>
        <button
          type="button"
          onClick={copyId}
          className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
        >
          <Copy size={12} />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* Info / Edit form */}
      <form onSubmit={handleSave} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Datos de la organización</p>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Nombre</label>
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            />
          ) : (
            <p className="text-sm text-zinc-200">{org.name}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Máx. usuarios</label>
            {editing ? (
              <input
                type="number"
                min={1}
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
            ) : (
              <p className="text-sm text-zinc-200">{org.maxUsers}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Email de contacto</label>
            {editing ? (
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
            ) : (
              <p className="text-sm text-zinc-200">{org.contactEmail ?? "—"}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-400">DIDIT Workflow ID</label>
          {editing ? (
            <input
              type="text"
              value={diditWorkflowId}
              onChange={(e) => setDiditWorkflowId(e.target.value)}
              placeholder="wf_xxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          ) : (
            <p className="text-sm font-mono text-zinc-200">{org.diditWorkflowId ?? "—"}</p>
          )}
        </div>

        {editing && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Logo oscuro</label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/50 px-4 py-5 hover:border-zinc-500 transition">
                  {logoDark ? (
                    <img src={URL.createObjectURL(logoDark)} alt="preview" className="h-10 object-contain" />
                  ) : org.logoDarkUrl ? (
                    <img src={org.logoDarkUrl} alt="actual" className="h-10 object-contain opacity-50" />
                  ) : (
                    <span className="text-xs text-zinc-600">Subir imagen</span>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoDark(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Logo claro</label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/50 px-4 py-5 hover:border-zinc-500 transition">
                  {logoLight ? (
                    <img src={URL.createObjectURL(logoLight)} alt="preview" className="h-10 object-contain" />
                  ) : org.logoLightUrl ? (
                    <img src={org.logoLightUrl} alt="actual" className="h-10 object-contain opacity-50" />
                  ) : (
                    <span className="text-xs text-zinc-600">Subir imagen</span>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoLight(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
