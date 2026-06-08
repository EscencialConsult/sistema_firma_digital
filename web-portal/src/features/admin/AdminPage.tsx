import { AlertCircle, FileSignature, ShieldAlert, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { StatCard } from "../../shared/components/ui/StatCard";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { AdminIdentityReviewPage } from "../identity/pages/AdminIdentityReviewPage";
import { adminApi, AdminUserDetail } from "./services/admin.api";

interface UsersListModalProps {
  onClose: () => void;
  onSelectUser: (id: string) => void;
}

function UsersListModal({ onClose, onSelectUser }: UsersListModalProps) {
  const { data: users, loading, error } = useApiResource(adminApi.listUsers, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200/50 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Usuarios Registrados</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Control de cuentas creadas en el sistema.</p>
          </div>
          <button
            type="button"
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center text-sm text-zinc-500 py-8">Cargando lista de usuarios...</p>
          ) : error ? (
            <div className="rounded-xl bg-rose-50/50 border border-rose-100 p-4 text-xs font-semibold text-rose-800 text-center">
              {error}
            </div>
          ) : !users?.length ? (
            <p className="text-center text-sm text-zinc-500 py-8">No hay usuarios registrados.</p>
          ) : (
            <div className="overflow-x-auto border border-zinc-200/50 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/30 text-xs font-semibold text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Nombre</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Verificación</th>
                    <th className="px-5 py-3">Creado el</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/70">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="group hover:bg-zinc-50/40 cursor-pointer transition duration-150"
                      onClick={() => onSelectUser(user.id)}
                    >
                      <td className="px-5 py-4 font-semibold text-zinc-950 group-hover:text-zinc-900">{user.full_name}</td>
                      <td className="px-5 py-4 text-zinc-500 font-mono text-xs">{user.email}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                          user.verification_status === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : user.verification_status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 ring-rose-100"
                              : user.verification_status === "IN_REVIEW"
                                ? "bg-amber-50 text-amber-700 ring-amber-100"
                                : "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
                        }`}>
                          {user.verification_status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-zinc-100 px-6 py-4 bg-zinc-50/50">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </footer>
      </div>
    </div>
  );
}

interface UserDetailsModalProps {
  userId: string;
  onClose: () => void;
}

function UserDetailsModal({ userId, onClose }: UserDetailsModalProps) {
  const [details, setDetails] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminApi.getUserDetails(userId)
      .then((res) => setDetails(res))
      .catch((err) => {
        console.error(err);
        setError("No se pudieron cargar los detalles del usuario.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200/50 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Ficha de Usuario</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Detalles de actividad e identidad.</p>
          </div>
          <button
            type="button"
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <p className="text-center text-sm text-zinc-500 py-8">Cargando detalles de usuario...</p>
          ) : error || !details ? (
            <div className="rounded-xl bg-rose-50/50 border border-rose-100 p-4 text-xs font-semibold text-rose-800 text-center">
              {error || "No se encontraron detalles."}
            </div>
          ) : (
            <>
              {/* Profile card summary */}
              <div className="rounded-2xl border border-zinc-200/50 bg-zinc-50/20 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white font-bold text-sm">
                    {details.user.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-950">{details.user.full_name}</h4>
                    <p className="text-xs text-zinc-500 font-mono">{details.user.email} · Rol: {details.user.role}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs border-t border-zinc-100 pt-3">
                  <div>
                    <span className="text-zinc-400 block font-medium">Estado KYC</span>
                    <span className={`inline-flex items-center rounded-full mt-1.5 px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      details.user.verification_status === "VERIFIED"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        : details.user.verification_status === "REJECTED"
                          ? "bg-rose-50 text-rose-700 ring-rose-100"
                          : "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
                    }`}>
                      {details.user.verification_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-medium">Firma / Certificado</span>
                    <span className={`inline-flex items-center rounded-full mt-1.5 px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      details.user.certificate_status === "ACTIVE" || details.user.certificate_status === "NONE"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        : "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
                    }`}>
                      {details.user.certificate_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Identity KYC record info if exists */}
              {details.identity ? (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Verificación de Identidad</h4>
                  <div className="rounded-xl border border-zinc-200/50 p-4 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-zinc-50 pb-2">
                      <span className="text-zinc-500">Documento</span>
                      <span className="font-semibold text-zinc-800">{details.identity.document_type} {details.identity.document_number}</span>
                    </div>
                    {details.identity.submitted_at && (
                      <div className="flex justify-between border-b border-zinc-50 pb-2">
                        <span className="text-zinc-500">Enviado el</span>
                        <span className="font-semibold text-zinc-800">{new Date(details.identity.submitted_at).toLocaleString()}</span>
                      </div>
                    )}
                    {details.identity.status === "REJECTED" && details.identity.rejection_reason && (
                      <div className="rounded-xl bg-rose-50/50 border border-rose-100 p-3 text-rose-800 mt-2">
                        <strong>Motivo de rechazo:</strong> {details.identity.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* User Documents */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Documentos del Usuario</h4>
                {details.documents?.length ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {details.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between border border-zinc-100 rounded-xl p-3 bg-zinc-50/10">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-900 truncate" title={doc.title}>{doc.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ml-2 ${
                          doc.status === "SIGNED"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : doc.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 ring-rose-100"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">El usuario no ha subido documentos.</p>
                )}
              </div>

              {/* User Certificates */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Certificados Asociados</h4>
                {details.certificates?.length ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {details.certificates.map((cert) => (
                      <div key={cert.id} className="flex items-center justify-between border border-zinc-100 rounded-xl p-3 bg-zinc-50/10">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-900 truncate" title={cert.label}>{cert.label}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Emisor: {cert.issuer || "Desconocido"} · Vence: {cert.valid_to ? new Date(cert.valid_to).toLocaleDateString() : "S/D"}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ml-2 ${
                          cert.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-rose-50 text-rose-700 ring-rose-100"
                        }`}>
                          {cert.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">No hay certificados criptográficos emitidos.</p>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-zinc-100 px-6 py-4 bg-zinc-50/50">
          <Button variant="secondary" onClick={onClose}>Cerrar ficha</Button>
        </footer>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { data, loading, error } = useApiResource(adminApi.stats, []);
  const [usersListOpen, setUsersListOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <>
      <PageHeader eyebrow="Administraci?n" title="Panel admin" description="Supervision real de usuarios, organizaciones, documentos e identidades." />
      {error ? <EmptyState icon={AlertCircle} title="No se pudieron cargar metricas admin" description={error} /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UsersRound} label="Usuarios registrados" value={loading ? "..." : String(data?.users ?? 0)} detail="Tabla users" onClick={() => setUsersListOpen(true)} />
        <StatCard icon={ShieldAlert} label="Identidades en revision" value={loading ? "..." : String(data?.identityPending ?? 0)} detail="Pendientes o en revision" />
        <StatCard icon={FileSignature} label="Documentos" value={loading ? "..." : String(data?.documents ?? 0)} detail="Repositorio completo" />
        <StatCard icon={UsersRound} label="Organizaciones" value={loading ? "..." : String(data?.organizations ?? 0)} detail="Tabla organizations" />
      </div>
      <div className="mt-8">
        <AdminIdentityReviewPage />
      </div>

      {usersListOpen ? (
        <UsersListModal
          onClose={() => setUsersListOpen(false)}
          onSelectUser={(id) => setSelectedUserId(id)}
        />
      ) : null}

      {selectedUserId ? (
        <UserDetailsModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      ) : null}
    </>
  );
}
