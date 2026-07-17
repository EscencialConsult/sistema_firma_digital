import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { getAllUsers, updateUserRole } from "../../shared/services/admin.service";
import {
  getOrgMemberships,
  updateMembershipStatus,
  getPendingInvitations,
  type OrgMembership,
  type OrgInvitation,
} from "../../shared/services/memberships.service";
import {
  getMyOrganization,
  regenerateInviteCode,
} from "../../shared/services/organizations.service";
import type { AdminUserSummary, UserRole } from "../../shared/types/user";

const ROLE_COLOR: Record<string, string> = {
  USER:      "bg-zinc-100 text-zinc-600",
  ORG_ADMIN: "bg-violet-100 text-violet-700",
  ADMIN:     "bg-violet-100 text-violet-700",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  VERIFIED:  { label: "Verificado",  icon: CheckCircle, color: "text-emerald-600" },
  IN_REVIEW: { label: "En revisión", icon: Clock,       color: "text-amber-500" },
  PENDING:   { label: "Pendiente",   icon: Clock,       color: "text-zinc-400" },
  REJECTED:  { label: "Rechazado",   icon: XCircle,     color: "text-red-500" },
  EXPIRED:   { label: "Expirado",    icon: XCircle,     color: "text-red-600" },
};

// ─── Modal: asignar admin desde usuarios existentes ───────────────────────────

function AssignAdminModal({
  orgId,
  currentAdminIds,
  onClose,
  onAssigned,
}: {
  orgId: string;
  currentAdminIds: string[];
  onClose: () => void;
  onAssigned: (user: AdminUserSummary) => void;
}) {
  const [allUsers, setAllUsers]   = useState<AdminUserSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<AdminUserSummary | null>(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    getAllUsers(orgId)
      .then((users) => setAllUsers(users.filter((u) => !currentAdminIds.includes(u.id) && u.role !== "ADMIN")))
      .finally(() => setLoading(false));
  }, [orgId]);

  const filtered = useMemo(() => {
    if (!search) return allUsers;
    const q = search.toLowerCase();
    return allUsers.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [allUsers, search]);

  async function handleAssign() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await updateUserRole(selected.id, "ORG_ADMIN");
      onAssigned({ ...selected, role: "ORG_ADMIN" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar rol");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Asignar admin</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Seleccioná un usuario existente para hacerlo admin</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Búsqueda */}
          <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 focus-within:border-zinc-400 transition">
            <Search size={14} className="text-zinc-400 shrink-0" />
            <input className="w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-500 outline-none"
              placeholder="Buscar usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Lista de usuarios */}
          <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-60 overflow-y-auto">
            {loading ? (
              Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse m-2 rounded-xl bg-zinc-100" />)
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">
                {allUsers.length === 0 ? "Sin usuarios disponibles" : "Sin resultados"}
              </p>
            ) : filtered.map((u) => (
              <button key={u.id} type="button" onClick={() => setSelected(u)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 ${selected?.id === u.id ? "bg-zinc-100" : ""}`}>
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-white">
                  {u.fullName[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{u.fullName}</p>
                  <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                </div>
                {selected?.id === u.id && <Check size={13} className="text-emerald-600 shrink-0" />}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition">
              Cancelar
            </button>
            <button type="button" onClick={handleAssign} disabled={!selected || saving}
              className="flex-1 h-10 rounded-xl text-sm font-semibold transition disabled:opacity-40 inline-flex items-center justify-center gap-2"
              style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {saving ? "Asignando..." : "Hacer admin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principal ───────────────────────────────────────────────────────────

export function AdminTeamPage() {
  const { user } = useAuth();
  const [users, setUsers]                     = useState<AdminUserSummary[]>([]);
  const [memberships, setMemberships]         = useState<OrgMembership[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<OrgInvitation[]>([]);
  const [inviteCode, setInviteCode]           = useState<string | undefined>(undefined);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [showAssign, setShowAssign]           = useState(false);
  const [codeCopied, setCodeCopied]           = useState(false);
  const [regenerating, setRegenerating]       = useState(false);

  useEffect(() => {
    if (!user?.organizationId) return;
    const orgId = user.organizationId;

    Promise.all([
      getAllUsers(orgId),
      getOrgMemberships(orgId),
      getPendingInvitations(orgId),
      getMyOrganization(),
    ])
      .then(([allUsers, membs, invs, org]) => {
        setUsers(allUsers.filter((u) => u.role === "ADMIN" || u.role === "ORG_ADMIN"));
        setMemberships(membs.filter((m) => m.status === "pending"));
        setPendingInvitations(invs);
        setInviteCode(org?.inviteCode);
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

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    });
  }

  async function handleRegenerate() {
    if (!user?.organizationId) return;
    setRegenerating(true);
    try {
      const newCode = await regenerateInviteCode(user.organizationId);
      setInviteCode(newCode);
    } catch { /* silencioso */ } finally {
      setRegenerating(false);
    }
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
        <button type="button" onClick={() => setShowAssign(true)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
          style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
          <ShieldCheck size={15} />
          Asignar admin
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Código de invitación */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Código de invitación</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Compartí este código con quien quieras que se una a tu organización. Primero deben crear su cuenta, luego ingresan este código en su perfil para unirse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3.5 text-center">
            <p className="font-mono text-2xl font-black tracking-[0.3em] text-zinc-900 select-all">
              {inviteCode ?? (loading ? "..." : "—")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={copyCode} disabled={!inviteCode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-40">
              {codeCopied ? <><Check size={13} className="text-emerald-500" /> Copiado</> : <><Copy size={13} /> Copiar</>}
            </button>
            <button type="button" onClick={handleRegenerate} disabled={regenerating || !inviteCode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition disabled:opacity-40">
              <RefreshCw size={13} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Regenerando..." : "Regenerar"}
            </button>
          </div>
        </div>
      </div>

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

      {/* Invitaciones enviadas (legacy — mientras el sistema de email siga activo) */}
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
            <p className="text-xs text-zinc-400">Compartí el código para que se unan, o creá uno directamente.</p>
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

      {showAssign && user?.organizationId && (
        <AssignAdminModal
          orgId={user.organizationId}
          currentAdminIds={users.map((u) => u.id)}
          onClose={() => setShowAssign(false)}
          onAssigned={(u) => setUsers((prev) => [u, ...prev])}
        />
      )}
    </div>
  );
}
