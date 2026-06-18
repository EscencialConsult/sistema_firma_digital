import { ArrowLeft, ImageIcon, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createOrganization,
  uploadOrgLogo,
} from "../../shared/services/organizations.service";
import type { Organization } from "../../shared/types/organization";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function LogoInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  const preview = value ? URL.createObjectURL(value) : null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-zinc-400">{label}</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/50 px-4 py-6 transition hover:border-zinc-500 hover:bg-zinc-800">
        {preview ? (
          <img src={preview} alt="preview" className="h-12 object-contain" />
        ) : (
          <ImageIcon size={24} className="text-zinc-600" />
        )}
        <span className="text-xs text-zinc-500">{hint}</span>
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

export function OrganizationNewPage() {
  const navigate = useNavigate();
  const [name, setName]               = useState("");
  const [slug, setSlug]               = useState("");
  const [slugManual, setSlugManual]   = useState(false);
  const [plan, setPlan]               = useState<Organization["plan"]>("basic");
  const [maxUsers, setMaxUsers]       = useState(50);
  const [contactEmail, setContactEmail] = useState("");
  const [diditWorkflowId, setDiditWorkflowId] = useState("");
  const [logoDark, setLogoDark]       = useState<File | null>(null);
  const [logoLight, setLogoLight]     = useState<File | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManual) setSlug(slugify(v));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const org = await createOrganization({
        name: name.trim(),
        slug: slug.trim(),
        plan,
        maxUsers,
        contactEmail: contactEmail.trim() || undefined,
        diditWorkflowId: diditWorkflowId.trim() || undefined,
      });

      if (logoDark)  await uploadOrgLogo(org.id, logoDark,  "dark");
      if (logoLight) await uploadOrgLogo(org.id, logoLight, "light");

      navigate(`/super-admin/organizations/${org.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la organización");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/super-admin/organizations"
          className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-500 hover:bg-zinc-800 transition"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nueva organización</h1>
          <p className="mt-0.5 text-sm text-zinc-400">Registrá una empresa en la plataforma.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Datos principales */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Datos principales</p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Nombre *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Empresa SA"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Slug (URL) *</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600">/join/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                placeholder="empresa-sa"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as Organization["plan"])}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Máx. usuarios</label>
              <input
                type="number"
                min={1}
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Email de contacto</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="admin@empresa.com"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">DIDIT Workflow ID</label>
            <input
              type="text"
              value={diditWorkflowId}
              onChange={(e) => setDiditWorkflowId(e.target.value)}
              placeholder="wf_xxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 font-mono focus:border-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Logos */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Identidad visual</p>
          <div className="grid grid-cols-2 gap-4">
            <LogoInput
              label="Logo para fondos oscuros"
              hint="PNG / SVG — fondo oscuro"
              value={logoDark}
              onChange={setLogoDark}
            />
            <LogoInput
              label="Logo para fondos claros"
              hint="PNG / SVG — fondo claro"
              value={logoLight}
              onChange={setLogoLight}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Creando..." : "Crear organización"}
        </button>
      </form>
    </div>
  );
}
