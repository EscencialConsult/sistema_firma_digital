import { ArrowLeft, ArrowRight, CheckCircle, FileText, Loader2, RefreshCw } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";
import { Stepper } from "../../shared/components/ui/Stepper";
import { supabase } from "../../shared/lib/supabase";
import { TERMS_TEXT } from "../../shared/legal/terms";
import { updateSessionUser } from "../../shared/services/auth.service";
import * as kycService from "../../shared/services/kyc.service";
import { KYC_STEP_LABELS, type KycPersonalData, type KycVerification } from "../../shared/types/kyc";

const EMPTY_PERSONAL: KycPersonalData = {
  fullName: "",
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

function personalDataFromVerification(
  verification: KycVerification,
  fallbackFullName: string
): KycPersonalData | null {
  if (verification.personalData) return verification.personalData;
  if (
    !verification.fullName &&
    !verification.documentNumber &&
    !verification.birthDate &&
    !verification.phone
  ) {
    return null;
  }

  return {
    fullName: verification.fullName ?? fallbackFullName,
    documentType: verification.documentType ?? "DNI",
    documentNumber: verification.documentNumber ?? "",
    cuilCuit: verification.cuitCuil ?? "",
    birthDate: verification.birthDate ?? "",
    phone: verification.phone ?? "",
    address: verification.address ?? "",
    city: verification.city ?? "",
    province: verification.province ?? "",
    country: verification.country ?? "Argentina",
  };
}

async function syncSessionVerificationProfile(
  verification: KycVerification,
  verificationStatus: KycVerification["status"]
) {
  await updateSessionUser({
    verificationStatus,
    fullName: verification.fullName ?? undefined,
    documentNumber: verification.documentNumber ?? undefined,
    cuilCuit: verification.cuitCuil ?? undefined,
    birthDate: verification.birthDate ?? undefined,
    phone: verification.phone ?? undefined,
    address: verification.address ?? undefined,
  });
}

// ─── Step 0: Personal data ───────────────────────────────────────────────────

function PersonalDataStep({
  data,
  onChange,
  onNext,
  loading,
}: {
  data: KycPersonalData;
  onChange: (d: KycPersonalData) => void;
  onNext: () => void;
  loading: boolean;
}) {
  function field(key: keyof KycPersonalData) {
    return {
      value: data[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange({ ...data, [key]: e.target.value }),
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">Datos personales</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Completá tus datos tal como figuran en tu documento de identidad.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Nombre completo" placeholder="María González" required {...field("fullName")} />
        </div>
        <Input label="Número de DNI" placeholder="40123456" required {...field("documentNumber")} />
        <Input label="CUIL / CUIT" placeholder="20-40123456-7" required {...field("cuilCuit")} />
        <Input label="Fecha de nacimiento" type="date" required {...field("birthDate")} />
        <Input label="Teléfono" placeholder="+54 381 555 1234" required {...field("phone")} />
        <div className="sm:col-span-2">
          <Input label="Domicilio" placeholder="Av. Mate de Luna 2500" required {...field("address")} />
        </div>
        <Input label="Ciudad" placeholder="San Miguel de Tucumán" required {...field("city")} />
        <Input label="Provincia" placeholder="Tucumán" required {...field("province")} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="h-11 px-8">
          {loading ? "Guardando..." : "Continuar"}
          <ArrowRight size={15} />
        </Button>
      </div>
    </form>
  );
}

function TermsStep({
  accepted,
  onAcceptedChange,
  onBack,
  onNext,
  loading,
}: {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
          <FileText size={18} />
        </div>
        <h2 className="text-lg font-bold text-zinc-950">Terminos y condiciones</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Antes de finalizar necesitamos registrar tu consentimiento.
        </p>
      </div>

      <div className="max-h-[360px] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50/40 p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-700">
          {TERMS_TEXT}
        </pre>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-950"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span className="text-sm leading-relaxed text-zinc-700">
          <span className="font-semibold text-zinc-950">Lei y acepto</span> los terminos,
          la politica de privacidad y el tratamiento de mis datos para completar la
          verificacion de identidad.
        </span>
      </label>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack} type="button">
          <ArrowLeft size={15} /> Atras
        </Button>
        <Button onClick={onNext} disabled={!accepted || loading} className="h-11 px-8">
          {loading ? "Guardando..." : "Aceptar y continuar"}
          {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Provider verification (Didit iframe) ─────────────────────────────

function FinalReviewStep({
  personalData,
  onBack,
  onFinish,
}: {
  personalData: KycPersonalData;
  onBack: () => void;
  onFinish: () => void;
}) {
  const items = [
    ["Nombre completo", personalData.fullName],
    ["DNI", personalData.documentNumber],
    ["CUIL / CUIT", personalData.cuilCuit],
    ["Fecha de nacimiento", personalData.birthDate],
    ["Telefono", personalData.phone],
    ["Domicilio", personalData.address],
    ["Ciudad", personalData.city],
    ["Provincia", personalData.province],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
          <CheckCircle size={18} />
        </div>
        <h2 className="text-lg font-bold text-zinc-950">Revision final</h2>
        <p className="mt-1 text-sm text-zinc-500">
          La verificacion de identidad fue completada. Revisa tus datos antes de continuar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4">
            <p className="text-[11px] font-bold uppercase text-zinc-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{value || "Sin cargar"}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Tu identidad fue validada y los terminos quedaron aceptados para esta cuenta.
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack} type="button">
          <ArrowLeft size={15} /> Atras
        </Button>
        <Button onClick={onFinish} className="h-11 px-8">
          Finalizar
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}

function ProviderVerificationStep({
  verification,
  onBack,
  onVerified,
  onExpired,
}: {
  verification: KycVerification;
  onBack: () => void;
  onVerified: (verification: KycVerification) => void;
  onExpired: () => void;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState<string>(verification.status);

  const handleProviderStatus = useCallback(async (currentStatus?: string) => {
    if (!currentStatus) return;
    setStatus(currentStatus);
    if (currentStatus === "VERIFIED") {
      const updatedVerification = await kycService.getMyVerification(verification.userId);
      const verifiedVerification = updatedVerification ?? { ...verification, status: "VERIFIED" as const };
      await syncSessionVerificationProfile(verifiedVerification, "VERIFIED");
      updateUser({ verificationStatus: "VERIFIED" });
      onVerified(verifiedVerification);
    } else if (currentStatus === "IN_REVIEW") {
      await syncSessionVerificationProfile(verification, "IN_REVIEW");
      updateUser({ verificationStatus: "IN_REVIEW" });
      navigate("/dashboard", { replace: true });
    } else if (currentStatus === "REJECTED") {
      await syncSessionVerificationProfile(verification, "REJECTED");
      updateUser({ verificationStatus: "REJECTED" });
      navigate("/kyc/rejected", { replace: true });
    } else if (currentStatus === "EXPIRED") {
      updateUser({ verificationStatus: "EXPIRED" });
      onExpired();
    }
  }, [navigate, onExpired, onVerified, updateUser, verification]);

  useEffect(() => {
    void handleProviderStatus(verification.status);
  }, [verification.status, handleProviderStatus]);

  useEffect(() => {
    if (status !== "PENDING") return;

    const channel = supabase
      .channel(`kyc_status_${verification.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "identity_verifications",
          filter: `id=eq.${verification.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status as string;
          if (newStatus && newStatus !== status) {
            void handleProviderStatus(newStatus);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [status, handleProviderStatus, verification.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Verificación de identidad</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Escaneá tu DNI y tomate una selfie para verificar tu identidad.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReload} type="button" title="Generar nuevo código QR si el anterior caducó">
            <RefreshCw size={15} /> Recargar
          </Button>
          <Button variant="secondary" onClick={onBack} type="button">
            <ArrowLeft size={15} /> Atrás
          </Button>
        </div>
      </div>

      {verification.providerSessionUrl ? (
        <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-white">
          <iframe
            src={verification.providerSessionUrl}
            allow="camera; microphone; fullscreen; autoplay; encrypted-media"
            className="w-full border-0"
            style={{ height: "680px" }}
            title="Verificación Didit"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/30 p-6 text-center space-y-4">
          <Loader2 size={48} className="animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-zinc-700 font-medium">
            Iniciando verificación...
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function KycWizardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [verification, setVerification] = useState<KycVerification | null>(null);
  const [personalData, setPersonalData] = useState<KycPersonalData>({
    ...EMPTY_PERSONAL,
    fullName: user?.fullName ?? "",
  });
  const [termsAccepted, setTermsAccepted] = useState(Boolean(user?.termsAcceptedAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTermsAccepted(Boolean(user?.termsAcceptedAt));
  }, [user?.termsAcceptedAt]);

  useEffect(() => {
    async function init() {
      if (!user) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          navigate("/login", { replace: true });
          return;
        }

        const { data: raw } = await supabase.rpc("get_my_kyc_status");
        const existing: KycVerification | null = raw as KycVerification | null;
        if (existing) {
          if (existing.status === "VERIFIED") {
            await syncSessionVerificationProfile(existing, "VERIFIED");
            if (user.verificationStatus !== "VERIFIED") {
              updateUser({ verificationStatus: "VERIFIED" });
            }
            setVerification(existing);
            const normalizedPersonalData = personalDataFromVerification(existing, user.fullName);
            if (normalizedPersonalData) setPersonalData(normalizedPersonalData);
            setStep(3);
            return;
          }
          if (existing.status === "IN_REVIEW") {
            await syncSessionVerificationProfile(existing, "IN_REVIEW");
            updateUser({ verificationStatus: "IN_REVIEW" });
            navigate("/dashboard", { replace: true });
            return;
          }
          if (existing.status === "REJECTED") {
            await syncSessionVerificationProfile(existing, "REJECTED");
            updateUser({ verificationStatus: "REJECTED" });
            navigate("/kyc/rejected", { replace: true });
            return;
          }
          if (existing.status === "EXPIRED") {
            updateUser({ verificationStatus: "EXPIRED" });
            setVerification(null);
            setStep(0);
            setError("La sesion de Didit ya no existe o expiro. Carga los datos y genera una nueva verificacion.");
            return;
          }
          setVerification(existing);
          const normalizedPersonalData = personalDataFromVerification(existing, user.fullName);
          if (normalizedPersonalData) {
            setPersonalData(normalizedPersonalData);
          }
          if (existing.provider || existing.providerSessionUrl) {
            setStep(2);
          } else if (user.termsAcceptedAt) {
            setStep(2);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo iniciar la verificación. Intentá recargar la página."
        );
      }
    }
    void init();
  }, [user, navigate, updateUser]);

  async function handlePersonalDataNext() {
    if (!user) return;
    setError(null);
    setLoading(true);

    try {
      const { data: verif } = await supabase
        .from("identity_verifications")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const verificationId = verif?.id ?? (await (async () => {
        const { data: newVer } = await supabase
          .from("identity_verifications")
          .insert({ user_id: user.id, status: "PENDING" })
          .select("id")
          .single();
        return newVer!.id;
      })());

      await supabase
        .from("identity_verifications")
        .update({
          full_name: personalData.fullName,
          document_type: personalData.documentType || "DNI",
          document_number: personalData.documentNumber,
          cuil_cuit: personalData.cuilCuit || null,
          birth_date: personalData.birthDate || null,
          phone: personalData.phone || null,
          address: personalData.address || null,
          city: personalData.city || null,
          province: personalData.province || null,
          country: personalData.country || "Argentina",
        })
        .eq("id", verificationId);
      await updateSessionUser({
        fullName: personalData.fullName,
        documentNumber: personalData.documentNumber,
        cuilCuit: personalData.cuilCuit || undefined,
        birthDate: personalData.birthDate,
        phone: personalData.phone,
        address: personalData.address || undefined,
      });

      const updatedVerification = await kycService.getMyVerification(user.id);
      if (updatedVerification) setVerification(updatedVerification);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los datos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTermsNext() {
    if (!user || !termsAccepted) return;
    setError(null);
    setLoading(true);

    try {
      if (!user.termsAcceptedAt) {
        const acceptedAt = new Date().toISOString();
        await updateSessionUser({ termsAcceptedAt: acceptedAt });
        updateUser({ termsAcceptedAt: acceptedAt });
      }

      await kycService.startProviderVerification();
      const updatedVerification = await kycService.getMyVerification(user.id);
      if (!updatedVerification) {
        throw new Error("No se pudo iniciar la verificacion.");
      }
      setVerification(updatedVerification);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aceptar terminos.");
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950">Verificación de identidad</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Para poder firmar documentos digitalmente necesitamos verificar tu identidad.
          El proceso toma menos de 2 minutos.
        </p>
      </div>

      <Stepper steps={KYC_STEP_LABELS} current={step} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {step === 0 && (
          <PersonalDataStep
            data={personalData}
            onChange={setPersonalData}
            onNext={handlePersonalDataNext}
            loading={loading}
          />
        )}
        {step === 1 && (
          <TermsStep
            accepted={termsAccepted}
            onAcceptedChange={setTermsAccepted}
            onBack={() => setStep(0)}
            onNext={handleTermsNext}
            loading={loading}
          />
        )}
        {step === 2 && verification && (
          <ProviderVerificationStep
            verification={verification}
            onBack={() => setStep(1)}
            onVerified={(verifiedVerification) => {
              setVerification(verifiedVerification);
              const normalizedPersonalData = personalDataFromVerification(verifiedVerification, user?.fullName ?? "");
              if (normalizedPersonalData) setPersonalData(normalizedPersonalData);
              setStep(3);
            }}
            onExpired={() => {
              setVerification(null);
              setStep(0);
              setError("La sesion de Didit ya no existe o expiro. Carga los datos y genera una nueva verificacion.");
            }}
            onReload={async () => {
              try {
                await kycService.startProviderVerification();
                const updatedVerification = await kycService.getMyVerification(user?.id ?? "");
                if (updatedVerification) setVerification(updatedVerification);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Error al recargar sesión.");
              }
            }}
          />
        )}
        {step === 3 && (
          <FinalReviewStep
            personalData={personalData}
            onBack={() => setStep(2)}
            onFinish={handleFinish}
          />
        )}
      </div>
    </div>
  );
}
