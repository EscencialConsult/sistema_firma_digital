import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          to="/super-admin/organizations"
          className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-500 hover:bg-zinc-800 transition"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Detalle de organización</h1>
          <p className="mt-0.5 text-sm text-zinc-500 font-mono">{id}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">
          El detalle de organización estará disponible cuando la migración de base de datos
          multitenant (B1) esté aplicada.
        </p>
      </div>
    </div>
  );
}
