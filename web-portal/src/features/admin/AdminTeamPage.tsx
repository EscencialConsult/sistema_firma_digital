import { UserPlus, Users } from "lucide-react";

export function AdminTeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Mi equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">Gestioná los usuarios de tu organización.</p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
        >
          <UserPlus size={16} />
          Invitar usuario
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-10 flex flex-col items-center gap-3 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100">
          <Users size={26} className="text-zinc-400" />
        </div>
        <p className="text-sm font-semibold text-zinc-600">Disponible próximamente</p>
        <p className="text-xs text-zinc-400 max-w-xs">
          La gestión de equipo estará disponible cuando la migración multitenant esté aplicada.
        </p>
      </div>
    </div>
  );
}
