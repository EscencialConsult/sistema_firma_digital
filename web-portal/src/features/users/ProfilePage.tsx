import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { getMyVerification } from "../../shared/services/kyc.service";
import { supabase } from "../../shared/lib/supabase";
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
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [kyc, setKyc]             = useState<KycVerification | null>(null);
  const [profileKycData, setProfileKycData] = useState<KycPersonalData | null>(null);
  const [kycLoading, setKycLoading] = useState(true);

  useEffect(() => {
    if (user) setFullName(user.fullName);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getMyVerification(user.id)
      .then(setKyc)
      .catch(console.error)
      .finally(() => setKycLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    async function loadProfileKycData() {
      try {
        const { data } = await supabase
          .from("users")
          .select("full_name, document_number, cuil_cuit, birth_date, phone, address")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (!data) return;
        const hasProfileKycData = Boolean(
          data.document_number ||
          data.cuil_cuit ||
          data.birth_date ||
          data.phone ||
          data.address
        );
        if (!hasProfileKycData) return;
        setProfileKycData({
          fullName: data.full_name ?? currentUser.fullName,
          documentType: "DNI",
          documentNumber: data.document_number ?? "",
          cuilCuit: data.cuil_cuit ?? "",
          birthDate: data.birth_date ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          city: "",
          province: "",
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

  const pd = kyc?.personalData ?? profileKycData;
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
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Gestioná tu información personal y revisá el estado de tu identidad verificada."
      />

      {/* ── Fila 1: avatar + edición ── */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* Avatar + estados */}
        <Card className="md:col-span-1 p-5 flex flex-col items-center text-center justify-between border border-zinc-200/50 bg-white">
          <div className="space-y-4 w-full">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-zinc-950 text-white font-bold text-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-zinc-950 text-base">{user.fullName}</h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{user.email}</p>
            </div>
          </div>
          <div className="w-full border-t border-zinc-100 pt-5 mt-5 space-y-3.5 text-xs text-left">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-zinc-400" /> Estado KYC
              </span>
              <StatusBadge status={user.verificationStatus} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <Award size={14} className="text-zinc-400" /> Firma Digital
              </span>
              <StatusBadge status={user.certificateStatus} />
            </div>
          </div>
        </Card>

        {/* Edición de nombre */}
        <Card className="md:col-span-2 border border-zinc-200/50 bg-white">
          <CardHeader
            title="Datos de cuenta"
            subtitle="Podés editar tu nombre. El email no puede cambiarse."
          />
          <form onSubmit={handleSave} className="p-5 space-y-5">
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
              <div className="space-y-2">
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
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 outline-none text-sm text-zinc-400 font-mono cursor-not-allowed"
                  value={user.email}
                  disabled
                />
                <span className="text-[10px] text-zinc-400 block">El email es inmutable para preservar la trazabilidad de firmas.</span>
              </div>
            </div>
            <div className="border-t border-zinc-100 pt-5 flex justify-end">
              <Button
                type="submit"
                disabled={saving || !fullName.trim() || fullName.trim() === user.fullName}
              >
                <UserCircle size={15} /> {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

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
