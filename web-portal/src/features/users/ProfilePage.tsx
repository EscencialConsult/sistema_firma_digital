import {
  AlertCircle,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  CreditCard,
  MapPin,
  Phone,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { getMyVerification } from "../../shared/services/kyc.service";
import { supabase } from "../../shared/lib/supabase";
import { getMyMemberships, joinOrgByCode, type OrgMembership } from "../../shared/services/memberships.service";
import { getMyOrganization } from "../../shared/services/organizations.service";
import type { KycPersonalData, KycVerification } from "../../shared/types/kyc";

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "Pendiente",
  IN_REVIEW: "En revisión",
  VERIFIED:  "Verificado",
  REJECTED:  "Rechazado",
  EXPIRED:   "Expirado",
  NONE:      "Sin certificado",
  ACTIVE:    "Activo",
  REVOKED:   "Revocado",
};

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  ACTIVE:   "bg-emerald-50 text-emerald-700 ring-emerald-100",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-100",
  REVOKED:  "bg-rose-50 text-rose-700 ring-rose-100",
  IN_REVIEW:"bg-amber-50 text-amber-700 ring-amber-100",
};
const defaultColor = "bg-zinc-100 text-zinc-700 ring-zinc-200/50";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_COLORS[status] ?? defaultColor}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ProfilePage() {
  const { user, updateUser, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [kyc, setKyc]             = useState<KycVerification | null>(null);
  const [profileKycData, setProfileKycData] = useState<KycPersonalData | null>(null);
  const [kycLoading, setKycLoading] = useState(true);

  // Organizaciones
  const [memberships, setMemberships]     = useState<OrgMembership[]>([]);
  const [inviteCode, setInviteCode]       = useState("");
  const [joinLoading, setJoinLoading]     = useState(false);
  const [joinError, setJoinError]         = useState<string | null>(null);
  const [joinedOrg, setJoinedOrg]         = useState<string | null>(null);

  useEffect(() => {
    if (user) setFullName(user.fullName);
  }, [user]);

  useEffect(() => {
    async function loadOrgs() {
      const [mbs, primaryOrg] = await Promise.all([
        getMyMemberships().catch(() => [] as OrgMembership[]),
        getMyOrganization().catch(() => null),
      ]);
      // Si la org primaria no tiene fila en organization_memberships, la inyectamos como entrada sintética
      if (primaryOrg && !mbs.some((m) => m.organizationId === primaryOrg.id)) {
        const synthetic: OrgMembership = {
          id: `primary-${primaryOrg.id}`,
          userId: user?.id ?? "",
          organizationId: primaryOrg.id,
          status: "active",
          role: "USER",
          createdAt: "",
          organization: {
            name: primaryOrg.name,
            slug: primaryOrg.slug ?? "",
            brandPrimary: primaryOrg.brandPrimary ?? undefined,
            logoLightUrl: primaryOrg.logoLightUrl ?? undefined,
            logoDarkUrl: primaryOrg.logoDarkUrl ?? undefined,
          },
        };
        setMemberships([synthetic, ...mbs]);
      } else {
        setMemberships(mbs);
      }
    }
    void loadOrgs();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyVerification(user.id)
      .then((v) => {
        if (cancelled) return;
        setKyc(v);
        if (v && v.status !== user.verificationStatus) {
          updateUser({ verificationStatus: v.status });
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setKycLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    async function loadProfileKycData() {
      try {
        const { data } = await supabase
          .from("users")
          .select("full_name, document_number, cuil_cuit, birth_date, phone, address, city, province")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (!data) return;
        setProfileKycData({
          fullName: data.full_name ?? currentUser.fullName,
          documentType: "DNI",
          documentNumber: data.document_number ?? "",
          cuilCuit: data.cuil_cuit ?? "",
          birthDate: data.birth_date ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          province: data.province ?? "",
          country: "Argentina",
        });
      } catch (err) {
        console.error(err);
      }
    }
    void loadProfileKycData();
  }, [user]);

  if (!user) {
    return (
      <div className="grid min-h-[300px] place-items-center text-zinc-500">
        <p className="text-sm font-semibold">Cargando perfil...</p>
      </div>
    );
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinLoading(true);
    setJoinError(null);
    setJoinedOrg(null);
    try {
      const org = await joinOrgByCode(inviteCode.trim());
      setJoinedOrg(org.name);
      setInviteCode("");
      // Refrescar lista de membresías
      const updated = await getMyMemberships();
      setMemberships(updated);
      await reloadUser();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim() === user?.fullName) return;
    setSaving(true); setSuccess(false); setError(null);
    try {
      await supabase.from("users").update({ full_name: fullName.trim() }).eq("id", user!.id);
      await reloadUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  let pd = kyc?.personalData ?? profileKycData;
  if (!pd && user.verificationStatus === "VERIFIED") {
    pd = {
      fullName: user.fullName,
      documentType: "DNI",
      documentNumber: "",
      cuilCuit: "",
      birthDate: "",
      phone: "",
      address: "",
      city: "",
      province: "",
      country: "Argentina",
    };
  }
  const canStartKyc = user.verificationStatus !== "VERIFIED" && user.verificationStatus !== "IN_REVIEW";
  const kycActionLabel =
    user.verificationStatus === "REJECTED"
      ? "Reintentar verificación"
      : user.verificationStatus === "EXPIRED"
        ? "Generar nueva verificación"
        : kyc?.status === "PENDING"
          ? "Continuar verificación"
          : "Iniciar verificación";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Gestioná tu información personal y revisá el estado de tu identidad verificada."
      />

      {/* ── Perfil + edición unificados ── */}
      <Card className="border border-zinc-200/50 bg-white overflow-hidden">
        <div className="flex flex-col md:flex-row md:divide-x md:divide-zinc-100">

          {/* Izquierda: identidad */}
          <div className="flex items-center gap-5 p-6 md:w-2/5">
            <div className="shrink-0 grid h-16 w-16 place-items-center rounded-2xl shadow-[0_10px_28px_rgba(0,0,0,0.12)]" style={{ background: "var(--brand-primary)" }}>
              <UserCircleIcon className="h-10 w-10" style={{ color: "var(--brand-primary-text)" }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-950 text-lg leading-tight truncate">{user.fullName}</h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">{user.email}</p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                  <ShieldCheck size={12} className="text-zinc-400 shrink-0" /> KYC — <StatusBadge status={user.verificationStatus} />
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                  <Award size={12} className="text-zinc-400 shrink-0" /> Firma Electrónica — <StatusBadge status={user.certificateStatus} />
                </span>
              </div>
            </div>
          </div>

          {/* Derecha: formulario */}
          <form onSubmit={handleSave} className="flex-1 p-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Datos de cuenta</p>
              <p className="text-xs text-zinc-400 mt-0.5">Podés editar tu nombre. El email no puede cambiarse.</p>
            </div>
            {success && (
              <div className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800 font-semibold items-center">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> Cambios guardados.
              </div>
            )}
            {error && (
              <div className="flex gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs text-rose-800 font-semibold items-center">
                <AlertCircle size={14} className="text-rose-600 shrink-0" /> {error}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Nombre completo</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition font-medium text-zinc-800"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre completo"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 outline-none text-sm text-zinc-400 font-mono cursor-not-allowed"
                  value={user.email}
                  disabled
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-100">
              <span className="text-[10px] text-zinc-400">El email es inmutable para preservar la trazabilidad de firmas.</span>
              <Button
                type="submit"
                disabled={saving || !fullName.trim() || fullName.trim() === user.fullName}
              >
                <UserCircle size={15} /> {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* ── Mis organizaciones ── */}
      <Card className="border border-zinc-200/50 bg-white">
        <CardHeader
          title="Mis organizaciones"
          subtitle="Empresas que pueden enviarte contratos para firmar."
        />
        <div className="p-5 space-y-5">

          {/* Lista de membresías activas */}
          {memberships.length > 0 && (
            <div className="space-y-2">
              {memberships.map((m) => {
                const logo = m.organization?.logoLightUrl ?? m.organization?.logoDarkUrl;
                const accent = m.organization?.brandPrimary ?? "var(--brand-primary)";
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg overflow-hidden"
                      style={{ background: logo ? "#f4f4f5" : accent + "22" }}
                    >
                      {logo
                        ? <img src={logo} alt={m.organization?.name} className="h-6 w-6 object-contain" />
                        : <Building2 size={15} style={{ color: accent }} />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {m.organization?.name ?? m.organizationId}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {m.status === "active" ? "Acceso activo" : "Pendiente de aprobación"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      m.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {m.status === "active" ? "Activa" : "Pendiente"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Unirse con código */}
          <form onSubmit={handleJoinByCode} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Ingresar código de empresa
              </label>
              <p className="mb-3 text-xs text-zinc-500 leading-5">
                Pedile el código de invitación al administrador de la empresa.
                Una vez que lo ingresés, esa empresa puede enviarte contratos para firmar.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ej: A3F9B2C1"
                  maxLength={12}
                  className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 font-mono text-sm font-bold tracking-[0.2em] text-zinc-900 placeholder-zinc-300 placeholder:tracking-normal placeholder:font-normal focus:border-zinc-400 focus:outline-none transition uppercase"
                />
                <Button type="submit" disabled={joinLoading || !inviteCode.trim()} className="shrink-0">
                  {joinLoading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : <Building2 size={14} />}
                  {joinLoading ? "Verificando..." : "Unirme"}
                </Button>
              </div>
            </div>

            {joinedOrg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                <Check size={14} className="shrink-0" />
                ¡Listo! Ya tenés acceso a <span className="font-bold">{joinedOrg}</span>.
              </div>
            )}
            {joinError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600">
                <AlertCircle size={14} className="shrink-0" />
                {joinError}
              </div>
            )}
          </form>
        </div>
      </Card>

      {/* ── Fila 2: datos KYC verificados ── */}
      <Card className="border border-zinc-200/50 bg-white">
        <CardHeader
          title="Identidad verificada"
          subtitle="Datos declarados durante el proceso KYC. Solo el equipo admin puede modificarlos."
        />
        <div className="p-5">
          {kycLoading ? (
            <p className="text-sm text-zinc-400">Cargando datos de identidad...</p>
          ) : !pd ? (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5 text-center">
              <Clock size={24} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-500">Sin datos KYC registrados</p>
              <p className="text-xs text-zinc-400 mt-1">Completá el proceso de verificación de identidad.</p>
              {canStartKyc ? (
                <Button type="button" className="mt-4 h-10 px-5" onClick={() => navigate("/kyc")}>
                  <ShieldCheck size={15} />
                  {kycActionLabel}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: UserCircle, label: "Nombre completo",  value: pd.fullName },
                { icon: CreditCard, label: "Tipo de documento", value: pd.documentType },
                { icon: CreditCard, label: "Número de DNI",    value: pd.documentNumber },
                { icon: CreditCard, label: "CUIL/CUIT",        value: pd.cuilCuit },
                { icon: Clock,      label: "Fecha de nacimiento", value: pd.birthDate },
                { icon: Phone,      label: "Teléfono",         value: pd.phone },
                { icon: MapPin,     label: "Dirección",        value: pd.address },
                { icon: MapPin,     label: "Ciudad",           value: pd.city },
                { icon: MapPin,     label: "Provincia",        value: pd.province },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">{value || "—"}</p>
                </div>
              ))}
            </div>
          )}

          {/* KYC status footer */}
          {kyc && (
            <div className={`mt-4 flex flex-col gap-3 rounded-xl p-3 text-xs font-semibold sm:flex-row sm:items-center sm:justify-between ${
              kyc.status === "VERIFIED"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                : kyc.status === "IN_REVIEW"
                  ? "bg-amber-50 text-amber-800 border border-amber-100"
                  : kyc.status === "REJECTED"
                    ? "bg-rose-50 text-rose-800 border border-rose-100"
                    : "bg-zinc-50 text-zinc-700 border border-zinc-100"
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="shrink-0" />
                <span>
                  {kyc.status === "VERIFIED"  && "Identidad verificada por el equipo de Escencial."}
                  {kyc.status === "IN_REVIEW" && "Tu documentación está siendo revisada. Te notificaremos pronto."}
                  {kyc.status === "REJECTED"  && `Verificación rechazada${kyc.rejectionReason ? `: ${kyc.rejectionReason}` : "."}`}
                  {kyc.status === "PENDING"   && "Completá el proceso KYC para verificar tu identidad."}
                  {kyc.status === "EXPIRED"   && "La verificación expiró. Podés iniciar una nueva solicitud."}
                </span>
              </div>
              {canStartKyc ? (
                <Button type="button" className="h-9 px-4 text-xs" onClick={() => navigate("/kyc")}>
                  <ShieldCheck size={14} />
                  {kycActionLabel}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
