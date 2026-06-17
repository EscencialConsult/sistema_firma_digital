import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { FileUpload } from "../../shared/components/ui/FileUpload";
import { Input } from "../../shared/components/ui/Input";
import { Stepper } from "../../shared/components/ui/Stepper";
import * as kycService from "../../shared/services/kyc.service";
import { KYC_STEP_LABELS, type KycDocument, type KycPersonalData } from "../../shared/types/kyc";

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

// ─── Step 1 & 2: Document upload ─────────────────────────────────────────────

function DocumentStep({
  title,
  description,
  document,
  uploading,
  onFile,
  onNext,
  onBack,
}: {
  title: string;
  description: string;
  document?: KycDocument;
  uploading: boolean;
  onFile: (f: File) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <FileUpload
        label={title}
        hint="Asegurate de que la imagen sea nítida y legible"
        onFile={onFile}
        preview={document?.previewUrl}
        loading={uploading}
        disabled={uploading}
      />

      {document && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          {document.fileName} cargado correctamente
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack} type="button">
          <ArrowLeft size={15} /> Atrás
        </Button>
        <Button onClick={onNext} disabled={!document || uploading} className="h-11 px-8">
          Continuar <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Selfie + submit ─────────────────────────────────────────────────

function SelfieStep({
  document,
  uploading,
  onFile,
  onSubmit,
  onBack,
  loading,
}: {
  document?: KycDocument;
  uploading: boolean;
  onFile: (f: File) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">Selfie de verificación</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tomá una foto de tu rostro mirando directamente a la cámara, en un lugar bien iluminado.
          No uses anteojos de sol ni ningún elemento que tape tu cara.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 space-y-2">
          <p className="font-semibold text-zinc-800 text-sm">✅ Correcto</p>
          <ul className="space-y-1">
            <li>· Rostro completo visible</li>
            <li>· Buena iluminación</li>
            <li>· Fondo neutro</li>
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 space-y-2">
          <p className="font-semibold text-zinc-800 text-sm">❌ Evitar</p>
          <ul className="space-y-1">
            <li>· Anteojos de sol</li>
            <li>· Poca luz o contra-luz</li>
            <li>· Rostro tapado parcialmente</li>
          </ul>
        </div>
      </div>

      <FileUpload
        label="Selfie"
        hint="Mirá directo a la cámara"
        onFile={onFile}
        preview={document?.previewUrl}
        loading={uploading}
        disabled={uploading}
      />

      {document && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          Selfie cargada correctamente
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack} type="button">
          <ArrowLeft size={15} /> Atrás
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!document || uploading || loading}
          className="h-11 px-8"
        >
          {loading ? "Enviando..." : "Enviar verificación"}
          <Send size={15} />
        </Button>
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function KycWizardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [personalData, setPersonalData] = useState<KycPersonalData>({
    ...EMPTY_PERSONAL,
    fullName: user?.fullName ?? "",
  });
  const [documents, setDocuments] = useState<
    Partial<Record<"DOCUMENT_FRONT" | "DOCUMENT_BACK" | "SELFIE", KycDocument>>
  >({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!user) return;
      try {
        const existing = await kycService.getMyVerification(user.id);
        if (existing) {
          setVerificationId(existing.id);
          if (existing.personalData) setPersonalData(existing.personalData);
        } else {
          const v = await kycService.startVerification(user.id);
          setVerificationId(v.id);
        }
      } catch {
        setError("No se pudo iniciar la verificación. Intentá recargar la página.");
      }
    }
    void init();
  }, [user]);

  async function handlePersonalDataNext() {
    if (!verificationId) return;
    setError(null);
    setLoading(true);
    try {
      await kycService.savePersonalData(verificationId, personalData);
      setStep(1);
    } catch {
      setError("Error al guardar los datos. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(
    type: "DOCUMENT_FRONT" | "DOCUMENT_BACK" | "SELFIE",
    file: File
  ) {
    if (!verificationId) return;
    setError(null);
    setUploading(type);
    try {
      const doc = await kycService.uploadDocument(verificationId, type, file);
      setDocuments((prev) => ({ ...prev, [type]: doc }));
    } catch {
      setError("Error al subir el archivo. Intentá con una imagen más pequeña.");
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    if (!verificationId) return;
    setError(null);
    setLoading(true);
    try {
      await kycService.submitVerification(verificationId);
      updateUser({ verificationStatus: "IN_REVIEW" });
      navigate("/kyc/pending");
    } catch {
      setError("Error al enviar la verificación. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950">Verificación de identidad</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Para poder firmar documentos digitalmente necesitamos verificar tu identidad.
          El proceso toma menos de 5 minutos.
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
          <DocumentStep
            title="Frente del DNI"
            description="Fotografiá el frente de tu DNI. Debe verse claramente tu foto, nombre, número y fecha de nacimiento."
            document={documents["DOCUMENT_FRONT"]}
            uploading={uploading === "DOCUMENT_FRONT"}
            onFile={(f) => handleFileUpload("DOCUMENT_FRONT", f)}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <DocumentStep
            title="Dorso del DNI"
            description="Fotografiá el dorso de tu DNI. Debe verse el código de barras y el número de trámite."
            document={documents["DOCUMENT_BACK"]}
            uploading={uploading === "DOCUMENT_BACK"}
            onFile={(f) => handleFileUpload("DOCUMENT_BACK", f)}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <SelfieStep
            document={documents["SELFIE"]}
            uploading={uploading === "SELFIE"}
            onFile={(f) => handleFileUpload("SELFIE", f)}
            onSubmit={handleSubmit}
            onBack={() => setStep(2)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
