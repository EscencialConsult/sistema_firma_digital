import { Building2, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizaciones</h1>
          <p className="mt-1 text-sm text-zinc-400">Gestioná las empresas registradas en la plataforma.</p>
        </div>
        <Link
          to="/super-admin/organizations/new"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition"
        >
          <Plus size={16} />
          Nueva organización
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 flex flex-col items-center gap-3 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-800">
          <Building2 size={26} className="text-zinc-500" />
        </div>
        <p className="text-sm font-semibold text-zinc-400">Sin organizaciones aún</p>
        <p className="text-xs text-zinc-600 max-w-xs">
          Esta sección estará disponible cuando la migración de base de datos multitenant esté aplicada.
        </p>
      </div>
    </div>
  );
}
