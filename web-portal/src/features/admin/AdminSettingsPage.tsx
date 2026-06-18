import { ImageIcon, Loader2, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  getMyOrganization,
  updateOrganization,
  uploadOrgLogo,
} from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";
import { OrgLogo } from "../../shared/components/ui/OrgLogo";

const PLAN_LABEL: Record<Organization["plan"], string> = {
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

function LogoUpload({
  label,
  currentUrl,
  variant,
  file,
  onChange,
}: {
  label: string;
  currentUrl?: string;
  variant: "dark" | "light";
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const preview = file ? URL.createObjectURL(file) : currentUrl;
  const bg = variant === "dark" ? "bg-zinc-800" : "bg-zinc-100";

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-zinc-500">{label}</p>
      <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 px-4 py-6 transition hover:border-zinc-400 ${bg}`}>
        {preview ? (
          <img src={preview} alt="logo preview" className="h-12 object-contain" />
        ) : (
          <>
            <ImageIcon size={22} className="text-zinc-400" />
            <span className="text-xs text-zinc-400">Subir imagen</span>
          </>
        )}
        {file && <span className="text-[10px] text-zinc-400 truncate max-w-full">{file.name}</span>}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

export function AdminSettingsPage() {
  const [org, setOrg]           = useState<Organization | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [contactEmail, setContactEmail]       = useState("");
  const [diditWorkflowId, setDiditWorkflowId] = useState("");
  const [logoDark, setLogoDark]               = useState<File | null>(null);
  const [logoLight, setLogoLight]             = useState<File | null>(null);

  useEffect(() => {
    getMyOrganization()
      .then((o) => {
        setOrg(o);
        if (o) {
          setContactEmail(o.contactEmail ?? "");
          setDiditWorkflowId(o.diditWorkflowId ?? "");
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
      let logoDarkUrl  = org.logoDarkUrl;
      let logoLightUrl = org.logoLightUrl;
      if (logoDark)  logoDarkUrl  = await uploadOrgLogo(org.id, logoDark,  "dark");
      if (logoLight) logoLightUrl = await uploadOrgLogo(org.id, logoLight, "light");

      await updateOrganization(org.id, {
        contactEmail:    contactEmail.trim() || undefined,
        diditWorkflowId: diditWorkflowId.trim() || undefined,
        logoDarkUrl:     logoDarkUrl  ?? null,
        logoLightUrl:    logoLightUrl ?? null,
      });

      setOrg({ ...org, contactEmail: contactEmail.trim() || undefined, diditWorkflowId: diditWorkflowId.trim() || undefined, logoDarkUrl, logoLightUrl });
      setLogoDark(null);
      setLogoLight(null);
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
              {PLAN_LABEL[org.plan]} · {org.maxUsers} usuarios máx.
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
        {/* Contacto y DIDIT */}
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

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">DIDIT Workflow ID</label>
            <input
              type="text"
              value={diditWorkflowId}
              onChange={(e) => setDiditWorkflowId(e.target.value)}
              placeholder="wf_xxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 font-mono placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Lo encontrás en tu cuenta de DIDIT → Workflows.
            </p>
          </div>
        </div>

        {/* Logos */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Logos</p>
          <p className="text-xs text-zinc-500">
            El logo oscuro se muestra en fondos negros (ej: sidebar Super Admin). El claro en fondos blancos (ej: sidebar de usuarios).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <LogoUpload
              label="Logo para fondos oscuros"
              currentUrl={org.logoDarkUrl}
              variant="dark"
              file={logoDark}
              onChange={setLogoDark}
            />
            <LogoUpload
              label="Logo para fondos claros"
              currentUrl={org.logoLightUrl}
              variant="light"
              file={logoLight}
              onChange={setLogoLight}
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
