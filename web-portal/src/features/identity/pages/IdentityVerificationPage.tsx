import { ArrowLeft, ArrowRight, RefreshCw, Send } from "lucide-react";
import { Button } from "../../../shared/components/ui/Button";
import { Card, CardHeader } from "../../../shared/components/ui/Card";
import { PageHeader } from "../../../shared/components/ui/PageHeader";
import { DeclarationStep, declarationText } from "../components/DeclarationStep";
import { DocumentUploadStep } from "../components/DocumentUploadStep";
import { IdentityStepper } from "../components/IdentityStepper";
import { IdentityStatusBadge } from "../components/IdentityStatusBadge";
import { PersonalDataStep } from "../components/PersonalDataStep";
import { ReviewStep } from "../components/ReviewStep";
import { SelfieUploadStep } from "../components/SelfieUploadStep";
import { useIdentityVerification } from "../hooks/useIdentityVerification";
import { IdentityStatusPage } from "./IdentityStatusPage";

export function IdentityVerificationPage() {
  const identity = useIdentityVerification();
  const isLastStep = identity.step === 4;

  if (identity.loading) {
    return (
      <div className="grid min-h-[300px] place-items-center text-sm font-semibold text-zinc-500">
        Cargando estado de identidad...
      </div>
    );
  }

  // If status is not pending (In review, Verified, Rejected), display the status dashboard
  if (identity.status !== "PENDING") {
    return (
      <>
        <PageHeader
          eyebrow="Validacion de identidad"
          title="Verificacion previa a la firma"
          description="Monitorea el estado de tu validacion para habilitar la firma electrónica."
          action={<IdentityStatusBadge status={identity.status} />}
        />
        <div className="space-y-6">
          <IdentityStatusPage status={identity.status} rejectionReason={identity.rejectionReason} />
          
          {identity.status === "REJECTED" ? (
            <Card className="border border-rose-100 bg-rose-50/50 p-5">
              <h3 className="text-sm font-bold text-rose-950">Corregir verificación de identidad</h3>
              <p className="mt-2 text-sm text-rose-800 font-medium">
                Tu solicitud fue rechazada por el administrador. Puedes corregir los datos y volver a enviarla para una nueva revisión.
              </p>
              <div className="mt-4">
                <Button type="button" onClick={identity.restart}>
                  <RefreshCw size={16} /> Iniciar nueva solicitud
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Validacion de identidad"
        title="Verificacion previa a la firma"
        description="Completa tus datos, adjunta DNI y selfie, acepta la declaracion jurada y envia la solicitud a revision manual."
        action={<IdentityStatusBadge status={identity.status} />}
      />

      {identity.error ? (
        <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-sm font-semibold text-rose-800">
          {identity.error}
        </div>
      ) : null}

      <div className="mb-6">
        <IdentityStepper currentStep={identity.step} onStepChange={identity.setStep} />
      </div>

      <Card>
        <CardHeader title="Wizard de identidad" subtitle="Tus datos y documentos reales se guardaran de manera segura." />
        <div className="p-5">
          {identity.step === 0 ? <PersonalDataStep value={identity.personalData} onChange={identity.setPersonalData} /> : null}
          {identity.step === 1 ? <DocumentUploadStep files={identity.files} setFiles={identity.setFiles} /> : null}
          {identity.step === 2 ? <SelfieUploadStep files={identity.files} setFiles={identity.setFiles} /> : null}
          {identity.step === 3 ? <DeclarationStep accepted={identity.declarationAccepted} onAcceptedChange={identity.setDeclarationAccepted} /> : null}
          {identity.step === 4 ? <ReviewStep personalData={identity.personalData} files={identity.files} declarationAccepted={identity.declarationAccepted} termsAccepted={identity.termsAccepted} onTermsChange={identity.setTermsAccepted} /> : null}

          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-zinc-100 pt-5 md:flex-row">
            <Button variant="secondary" type="button" disabled={identity.step === 0} onClick={() => identity.setStep(Math.max(0, identity.step - 1))}>
              <ArrowLeft size={16} /> Atrás
            </Button>
            {isLastStep ? (
              <Button type="button" disabled={!identity.declarationAccepted || !identity.termsAccepted} onClick={identity.submit}>
                <Send size={14} /> Enviar a revisión
              </Button>
            ) : (
              <Button type="button" onClick={() => identity.setStep(Math.min(4, identity.step + 1))}>
                Siguiente <ArrowRight size={16} />
              </Button>
            )}
          </div>

          <p className="mt-4 text-xs text-zinc-400">Declaración v1.0: {declarationText}</p>
        </div>
      </Card>
    </>
  );
}
