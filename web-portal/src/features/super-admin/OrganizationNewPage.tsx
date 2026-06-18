import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function OrganizationNewPage() {
  return (
    <div className="space-y-6 max-w-2xl">
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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">
          El formulario de alta de organización estará disponible cuando la migración de base de datos
          multitenant (B1) esté aplicada por Santi.
        </p>
      </div>
    </div>
  );
}
