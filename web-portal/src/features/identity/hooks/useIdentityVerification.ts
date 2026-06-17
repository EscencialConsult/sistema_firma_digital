import { useEffect, useMemo, useState } from "react";
import type { IdentityDocumentType, IdentityStatus, PersonalData } from "../types/identity.types";
import { identityApi } from "../services/identity.api";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/providers/AuthProvider";

const initialPersonalData: PersonalData = {
  fullName: "",
  documentType: "DNI",
  documentNumber: "",
  birthDate: "",
  nationality: "Argentina",
  country: "Argentina",
  province: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  cuitCuil: ""
};

export function useIdentityVerification() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<IdentityStatus>("PENDING");
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);
  const [personalData, setPersonalData] = useState<PersonalData>(initialPersonalData);
  const [files, setFiles] = useState<Record<IdentityDocumentType, File | null>>({
    DOCUMENT_FRONT: null,
    DOCUMENT_BACK: null,
    SELFIE: null
  });
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(!!user?.termsAcceptedAt);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load status on mount
  useEffect(() => {
    identityApi.me()
      .then((res) => {
        const verification = res.data;
        if (verification) {
          setStatus(verification.status);
          setRejectionReason(verification.rejectionReason ?? undefined);
          setDeclarationAccepted(verification.declarationAccepted ?? false);
          setPersonalData({
            fullName: verification.fullName || user?.fullName || "",
            documentType: verification.documentType || "DNI",
            documentNumber: verification.documentNumber || "",
            birthDate: verification.birthDate ? verification.birthDate.split("T")[0] : "",
            nationality: verification.nationality || "Argentina",
            country: verification.country || "Argentina",
            province: verification.province || "",
            city: verification.city || "",
            address: verification.address || "",
            phone: verification.phone || "",
            email: verification.email || user?.email || "",
            cuitCuil: verification.cuitCuil || ""
          });
        } else if (user) {
          setPersonalData((prev) => ({
            ...prev,
            fullName: user.fullName || "",
            email: user.email || ""
          }));
        }
      })
      .catch((err) => {
        console.error("Error cargando identidad:", err);
        setError("Error al cargar la información de identidad.");
        if (user) {
          setPersonalData((prev) => ({
            ...prev,
            fullName: user.fullName || "",
            email: user.email || ""
          }));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const completion = useMemo(() => {
    const personalReady = Boolean(personalData.fullName && personalData.documentNumber && personalData.birthDate && personalData.email && personalData.phone);
    const docsReady = Boolean(files.DOCUMENT_FRONT || files.DOCUMENT_BACK);
    const selfieReady = Boolean(files.SELFIE);
    const termsReady = termsAccepted || !!user?.termsAcceptedAt;
    return { personalReady, docsReady, selfieReady, declarationReady: declarationAccepted, termsReady };
  }, [declarationAccepted, files, personalData, termsAccepted, user?.termsAcceptedAt]);

  // Dynamic step navigation with automatic backend syncing
  async function navigateToStep(targetStep: number) {
    if (targetStep > 4) return; // step 5 is visual-only in the stepper
    setError(null);
    try {
      // 1. If moving from Personal Data (Step 0)
      if (step === 0 && targetStep > 0) {
        if (!completion.personalReady) {
          throw new Error("Por favor completa todos los campos requeridos.");
        }
        await identityApi.start();
        await identityApi.updatePersonalData(personalData);
      }

      // 2. If moving from Document Upload (Step 1)
      if (step === 1 && targetStep > 1) {
        if (files.DOCUMENT_FRONT) {
          await identityApi.uploadDocumentFront(files.DOCUMENT_FRONT);
        }
        if (files.DOCUMENT_BACK) {
          await identityApi.uploadDocumentBack(files.DOCUMENT_BACK);
        }
      }

      // 3. If moving from Selfie Upload (Step 2)
      if (step === 2 && targetStep > 2) {
        if (files.SELFIE) {
          await identityApi.uploadSelfie(files.SELFIE);
        }
      }

      setStep(targetStep);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al guardar los datos del paso actual.");
    }
  }

  async function submit() {
    setError(null);
    try {
      // Save terms acceptance if not already saved
      if (!user?.termsAcceptedAt && termsAccepted) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ terms_accepted_at: new Date().toISOString() })
          .eq("id", user!.id);

        if (updateError) throw new Error("No se pudieron guardar los términos aceptados.");
      }

      await identityApi.submit({
        declarationAccepted: true,
        declarationText: "Acepto y declaro bajo juramento que los datos e imágenes presentados son válidos y verdaderos.",
        declarationVersion: "1.0"
      });
      setStatus("IN_REVIEW");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo enviar la solicitud de verificación.");
    }
  }

  async function restart() {
    setError(null);
    setLoading(true);
    try {
      const res = await identityApi.start();
      const verification = res.data;
      setStatus(verification.status);
      setRejectionReason(undefined);
      setStep(0);
      setDeclarationAccepted(false);
      setTermsAccepted(!!user?.termsAcceptedAt);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo reiniciar el proceso.");
    } finally {
      setLoading(false);
    }
  }

  return {
    step,
    setStep: navigateToStep,
    status,
    rejectionReason,
    personalData,
    setPersonalData,
    files,
    setFiles,
    declarationAccepted,
    setDeclarationAccepted,
    termsAccepted,
    setTermsAccepted,
    completion,
    loading,
    error,
    submit,
    restart
  };
}
