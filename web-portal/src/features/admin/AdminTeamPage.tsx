import {
  CheckCircle,
  Clock,
  Loader2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { createAdminUser, getAllUsers, updateUserRole } from "../../shared/services/admin.service";
import type { AdminUserSummary, UserRole } from "../../shared/types/user";

const ROLE_LABEL: Record<string, string> = {
  USER: "Usuario",
  ORG_ADMIN: "Admin",
  ADMIN: "Admin",
};

const ROLE_COLOR: Record<string, string> = {
  USER: "bg-zinc-100 text-zinc-600",
  ORG_ADMIN: "bg-violet-100 text-violet-700",
  ADMIN: "bg-violet-100 text-violet-700",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  VERIFIED:  { label: "Verificado",  icon: CheckCircle, color: "text-emerald-600" },
  IN_REVIEW: { label: "En revisión", icon: Clock,       color: "text-amber-500" },
  PENDING:   { label: "Pendiente",   icon: Clock,       color: "text-zinc-400" },
  REJECTED:  { label: "Rechazado",   icon: XCircle,     color: "text-red-500" },
  EXPIRED:   { label: "Expirado",    icon: XCircle,     color: "text-red-600" },
};

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: AdminUserSummary) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState<UserRole>("USER");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await createAdminUser({ fullName, email, password, role });
      onCreated(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el usuario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-bold text-zinc-900">Invitar usuario</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          {[
            { label: "Nombre completo", value: fullName, setter: setFullName, type: "text", placeholder: "Juan Pérez" },
            { label: "Email",           value: email,    setter: setEmail,    type: "email", placeholder: "juan@empresa.com" },
            { label: "Contraseña",      value: password, setter: setPassword, type: "password", placeholder: "Mínimo 8 caracteres" },
          ].map(({ label, value, setter, type, placeholder }) => (
            <div key={label}>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">{label}</label>
              <input
                type={type}
                required
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
            >
              <option value="USER">Usuario</option>
              <option value="ORG_ADMIN">Admin de organización</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {loading ? "Creando..." : "Crear usuario"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminTeamPage() {
  const [users, setUsers]         = useState<AdminUserSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    await updateUserRole(userId, newRole).catch(() => null);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Mi equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {loading ? "Cargando..." : `${users.length} usuario${users.length !== 1 ? "s" : ""} en tu organización`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition"
        >
          <UserPlus size={16} />
          Invitar usuario
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />)}
        </div>
      )}

      {!loading && users.length === 0 && !error && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold text-zinc-500">Sin usuarios aún</p>
          <p className="text-xs text-zinc-400">Invitá el primer miembro de tu organización.</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-3 text-left">Usuario</th>
                <th className="px-5 py-3 text-left">KYC</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-left">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => {
                const status = STATUS_CONFIG[u.verificationStatus] ?? STATUS_CONFIG.PENDING;
                const StatusIcon = status.icon;
                return (
                  <tr key={u.id} className="hover:bg-zinc-50 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-zinc-900">{u.fullName}</p>
                      <p className="text-xs text-zinc-400">{u.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                        <StatusIcon size={13} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-300 ${ROLE_COLOR[u.role] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        <option value="USER">Usuario</option>
                        <option value="ORG_ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-400">
                      {new Date(u.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onCreated={(u) => setUsers((prev) => [u, ...prev])}
        />
      )}
    </div>
  );
}
