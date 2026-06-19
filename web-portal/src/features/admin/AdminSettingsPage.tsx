import { Loader2, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getMyOrganization, updateOrganization } from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

export function AdminSettingsPage() {
  const [org, setOrg]         = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    getMyOrganization()
      .then((o) => {
        setOrg(o);
        if (o) setContactEmail(o.contactEmail ?? "");
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

  return (
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

      <form onSubmit={handleSubmit} className="space-y-5">
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
