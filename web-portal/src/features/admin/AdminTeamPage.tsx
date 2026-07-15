import {
  CheckCircle,
  Clock,
  Copy,
  Check,
  Loader2,
  Mail,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { createAdminUser, getAllUsers, updateUserRole } from "../../shared/services/admin.service";
import {
  inviteUserToOrg,
  getOrgMemberships,
  updateMembershipStatus,
  getPendingInvitations,
  type OrgMembership,
  type OrgInvitation,
} from "../../shared/services/memberships.service";
import type { AdminUserSummary, UserRole } from "../../shared/types/user";

const ROLE_LABEL: Record<string, string> = {
  USER:     "Usuario",
  ORG_ADMIN: "Admin",
  ADMIN:    "Admin",
};

const ROLE_COLOR: Record<string, string> = {
  USER:     "bg-zinc-100 text-zinc-600",
  ORG_ADMIN: "bg-violet-100 text-violet-700",
  ADMIN:    "bg-violet-100 text-violet-700",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  VERIFIED:  { label: "Verificado",  icon: CheckCircle, color: "text-emerald-600" },
  IN_REVIEW: { label: "En revisión", icon: Clock,       color: "text-amber-500" },
  PENDING:   { label: "Pendiente",   icon: Clock,       color: "text-zinc-400" },
  REJECTED:  { label: "Rechazado",   icon: XCircle,     color: "text-red-500" },
  EXPIRED:   { label: "Expirado",    icon: XCircle,     color: "text-red-600" },
};

// ─── Modal: crear usuario nuevo (admin) ──────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: AdminUserSummary) => void }) {
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
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-bold text-zinc-900">Crear usuario nuevo</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          {[
            { label: "Nombre completo", value: fullName, setter: setFullName, type: "text",     placeholder: "Juan Pérez" },
            { label: "Email",           value: email,    setter: setEmail,    type: "email",    placeholder: "juan@empresa.com" },
            { label: "Contraseña",      value: password, setter: setPassword, type: "password", placeholder: "Mínimo 8 caracteres" },
          ].map(({ label, value, setter, type, placeholder }) => (
            <div key={label}>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500">{label}</label>
              <input type={type} required value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none">
              <option value="USER">Usuario</option>
              <option value="ORG_ADMIN">Admin de organización</option>
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {loading ? "Creando..." : "Crear usuario"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: invitar usuario existente (multi-org) ────────────────────────────

function InviteExistingModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await inviteUserToOrg(email, orgId);
      const link = `${window.location.origin}/invite/${token}`;
      setInviteLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la invitación.");
    } finally { setLoading(false); }
  }

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-bold text-zinc-900">Invitar usuario existente</h3>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs leading-5 text-zinc-500">
            Ingresá el email de una persona que ya tenga cuenta en la plataforma.
            Se genera un link de invitación que podés copiar y enviar por donde quieras.
          </p>

          {!inviteLink ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Email del usuario</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@correo.com"
                    className="w-full rounded-xl border border-zinc-200 py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition disabled:opacity-50">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                {loading ? "Generando..." : "Generar link de invitación"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                ✓ Link generado. Copialo y enviáselo al usuario por email, WhatsApp o donde prefieras.
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[11px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Link de invitación</p>
                <p className="text-xs text-zinc-700 break-all font-mono leading-5">{inviteLink}</p>
              </div>
              <button type="button" onClick={copyLink}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition">
                {copied ? <><Check size={15} className="text-emerald-500" /> Copiado</> : <><Copy size={15} /> Copiar link</>}
              </button>
              <button type="button" onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition">
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page principal ───────────────────────────────────────────────────────────

type Modal = "create" | "invite" | null;

export function AdminTeamPage() {
  const { user } = useAuth();
  const [users, setUsers]         = useState<AdminUserSummary[]>([]);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [modal, setModal]         = useState<Modal>(null);

  useEffect(() => {
    if (!user?.organizationId) return;
    const orgId = user.organizationId;

    Promise.all([
      getAllUsers(orgId),
      getOrgMemberships(orgId),
      getPendingInvitations(orgId),
    ])
      .then(([allUsers, membs, invs]) => {
        setUsers(allUsers.filter((u) => u.role === "ADMIN" || u.role === "ORG_ADMIN"));
        setMemberships(membs.filter((m) => m.status === "pending"));
        setPendingInvitations(invs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user?.organizationId]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    await updateUserRole(userId, newRole).catch(() => null);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
  }

  async function handleMembershipAction(membershipId: string, action: "active" | "rejected") {
    await updateMembershipStatus(membershipId, action).catch(() => null);
    setMemberships((prev) => prev.filter((m) => m.id !== membershipId));
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Mi equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {loading ? "Cargando..." : `${users.length} admin${users.length !== 1 ? "s" : ""} en tu organización`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModal("invite")}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition">
            <Mail size={15} />
            Invitar existente
          </button>
          <button type="button" onClick={() => setModal("create")}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition">
            <UserPlus size={15} />
            Crear usuario
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Solicitudes de acceso pendientes */}
      {memberships.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
            <Clock size={14} className="text-amber-500" />
            Solicitudes de acceso pendientes
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {memberships.length}
            </span>
          </h2>
          <div className="divide-y divide-zinc-100 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
            {memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{m.user?.fullName ?? "Usuario"}</p>
                  <p className="text-xs text-zinc-500">{m.user?.email ?? m.userId}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleMembershipAction(m.id, "active")}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition">
                    Aprobar
                  </button>
                  <button type="button" onClick={() => handleMembershipAction(m.id, "rejected")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition">
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invitaciones enviadas pendientes */}
      {pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
            <Mail size={14} className="text-zinc-400" />
            Invitaciones enviadas (sin aceptar)
          </h2>
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{inv.email}</p>
                  <p className="text-xs text-zinc-400">
                    Vence {new Date(inv.expiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                  </p>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de admins */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-700 flex items-center gap-2">
          <Users size={14} className="text-zinc-400" />
          Administradores
        </h2>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />)}
          </div>
        )}

        {!loading && users.length === 0 && !error && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold text-zinc-500">Sin administradores aún</p>
            <p className="text-xs text-zinc-400">Creá o invitá el primer miembro del equipo.</p>
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
                        <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-300 ${ROLE_COLOR[u.role] ?? "bg-zinc-100 text-zinc-600"}`}>
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
      </div>

      {modal === "create" && (
        <CreateUserModal onClose={() => setModal(null)} onCreated={(u) => setUsers((prev) => [u, ...prev])} />
      )}
      {modal === "invite" && user?.organizationId && (
        <InviteExistingModal orgId={user.organizationId} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
