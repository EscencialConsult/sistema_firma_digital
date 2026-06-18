import { Building2, ImageIcon, Palette } from "lucide-react";

const SECTIONS = [
  { icon: Building2, label: "Datos de la organización", desc: "Nombre, slug, contacto, plan." },
  { icon: ImageIcon,  label: "Logos",                   desc: "Logo para fondos claros y oscuros." },
  { icon: Palette,    label: "Identidad visual",        desc: "Color principal de la organización." },
];

export function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-500">Personalizá tu organización en la plataforma.</p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 opacity-60"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100">
              <Icon size={18} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800">{label}</p>
              <p className="text-xs text-zinc-400">{desc}</p>
            </div>
            <span className="ml-auto text-xs font-medium text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-lg">
              Próximamente
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
