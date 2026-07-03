import { CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";

type OnboardingVariant = "kyc" | "user" | "admin" | "super-admin";

interface OnboardingTourProps {
  variant: OnboardingVariant;
}

interface TourStep {
  title: string;
  body: string;
  action: string;
}

const STEPS: Record<OnboardingVariant, TourStep[]> = {
  kyc: [
    {
      title: "Bienvenido a Firma Digital",
      body: "Antes de firmar o gestionar documentos, necesitamos validar tu identidad para proteger tu cuenta.",
      action: "Completa los datos personales y revisa que coincidan con tu documento.",
    },
    {
      title: "Verifica tu identidad",
      body: "El proceso KYC confirma que sos la persona que va a usar la firma electronica.",
      action: "Tene a mano tu DNI y segui las instrucciones de la pantalla.",
    },
    {
      title: "Espera la aprobacion",
      body: "Cuando la verificacion quede aprobada, vas a entrar automaticamente al panel principal.",
      action: "Si algo falla, revisa el motivo y vuelve a intentarlo desde esta pantalla.",
    },
  ],
  user: [
    {
      title: "Tu panel de contratos",
      body: "En Dashboard ves un resumen de firmas pendientes, firmadas y actividad reciente.",
      action: "Empeza revisando si tenes contratos pendientes.",
    },
    {
      title: "Firma documentos",
      body: "En Mis contratos aparecen las solicitudes que te enviaron. Los pendientes muestran el boton Firmar ahora.",
      action: "Abri el contrato, acepta la conformidad, valida tu identidad y dibuja tu firma.",
    },
    {
      title: "Consulta PDFs firmados",
      body: "Cuando un contrato queda firmado, el boton Ver PDF completo abre el documento junto con su certificado.",
      action: "Usa ese PDF como comprobante final de la firma.",
    },
    {
      title: "Revisa tu perfil",
      body: "En Perfil podes consultar tus datos, estado KYC y configuracion de cuenta.",
      action: "Manten tus datos actualizados para evitar rechazos en futuras firmas.",
    },
  ],
  admin: [
    {
      title: "Panel de administracion",
      body: "El Dashboard resume usuarios, verificaciones KYC, contratos enviados y firmas completadas.",
      action: "Usalo como vista diaria de seguimiento.",
    },
    {
      title: "Gestiona usuarios y KYC",
      body: "En Usuarios ves las cuentas de tu organizacion. En Verificaciones KYC podes aprobar o rechazar identidades.",
      action: "Revisa KYC pendientes antes de enviar contratos sensibles.",
    },
    {
      title: "Crea y envia contratos",
      body: "En Contratos podes usar plantillas, elegir autoridad firmante y destinatario, y completar variables.",
      action: "Cuando el contrato este firmado, usa el unico boton PDF firmado.",
    },
    {
      title: "Auditoria y equipo",
      body: "Los logs muestran acciones importantes. Mi equipo y Configuracion te ayudan a administrar la organizacion.",
      action: "Consulta auditoria cuando necesites trazabilidad.",
    },
  ],
  "super-admin": [
    {
      title: "Vista global de plataforma",
      body: "El panel super admin muestra metricas globales y acceso a la gestion de organizaciones.",
      action: "Usalo para monitorear el estado general del sistema.",
    },
    {
      title: "Administra organizaciones",
      body: "En Organizaciones podes crear, revisar y editar las entidades que usan la app.",
      action: "Verifica datos de contacto y estado antes de habilitar operaciones.",
    },
    {
      title: "Configuracion global",
      body: "En Configuracion se centralizan parametros compartidos por toda la plataforma.",
      action: "Cambia estos valores con cuidado porque impactan a todos los usuarios.",
    },
  ],
};

function variantLabel(variant: OnboardingVariant) {
  if (variant === "kyc") return "Primeros pasos";
  if (variant === "user") return "Guia de usuario";
  if (variant === "admin") return "Guia admin";
  return "Guia super admin";
}

export function OnboardingTour({ variant }: OnboardingTourProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = useMemo(
    () => (user?.id ? `onboarding:${variant}:${user.id}:v1` : null),
    [user?.id, variant]
  );
  const steps = STEPS[variant];
  const current = steps[step];
  const progress = `${step + 1}/${steps.length}`;

  useEffect(() => {
    if (!storageKey) return;
    if (localStorage.getItem(storageKey) !== "done") {
      setOpen(true);
      setStep(0);
    }
  }, [storageKey]);

  function close(markDone = true) {
    if (markDone && storageKey) localStorage.setItem(storageKey, "done");
    setOpen(false);
  }

  function next() {
    if (step >= steps.length - 1) close(true);
    else setStep((value) => value + 1);
  }

  function previous() {
    setStep((value) => Math.max(0, value - 1));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-lg transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        <HelpCircle size={15} />
        Ayuda
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {variantLabel(variant)} - Paso {progress}
                </p>
                <h2 className="mt-1 text-lg font-bold text-zinc-950">{current.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => close(true)}
                className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Cerrar tutorial"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm leading-relaxed text-zinc-700">{current.body}</p>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p className="text-xs font-medium leading-relaxed text-emerald-800">{current.action}</p>
                </div>
              </div>

              <div className="flex gap-1.5">
                {steps.map((item, index) => (
                  <span
                    key={item.title}
                    className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-zinc-950" : "bg-zinc-200"}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => close(true)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                Omitir tutorial
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={previous}
                  disabled={step === 0}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 px-4 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800"
                >
                  {step === steps.length - 1 ? "Finalizar" : "Siguiente"}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
