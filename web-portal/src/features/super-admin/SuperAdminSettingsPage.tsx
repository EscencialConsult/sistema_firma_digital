import { Globe, Key, Mail } from "lucide-react";

const SECTIONS = [
  { icon: Key,    label: "Credenciales DIDIT",  desc: "API key y webhooks globales de DIDIT." },
  { icon: Mail,   label: "Configuración email", desc: "Templates y remitente de notificaciones." },
  { icon: Globe,  label: "Dominio y URLs",      desc: "URLs de callback, redirect y producción." },
];

export function SuperAdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración global</h1>
        <p className="mt-1 text-sm text-zinc-400">Parámetros globales de la plataforma Escencial.</p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 opacity-60"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-800">
              <Icon size={18} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
            <span className="ml-auto text-xs font-medium text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-lg">
              Próximamente
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
