import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import * as kycService from "../../shared/services/kyc.service";
import type { KycVerification } from "../../shared/types/kyc";

export function KycRejectedPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [verification, setVerification] = useState<KycVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVerification() {
      if (!user) return;
      try {
        const data = await kycService.getMyVerification(user.id);
        setVerification(data);
      } catch (err) {
        console.error("Error al cargar la verificación", err);
      } finally {
        setLoading(false);
      }
    }
    void loadVerification();
  }, [user]);

  function handleRetry() {
    updateUser({ verificationStatus: "PENDING" });
    navigate("/kyc");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={36} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  const defaultReason = "No se pudo validar tu identidad con las imágenes provistas. Por favor, asegúrate de que sean claras y sin reflejos.";
  const reason = verification?.rejectionReason || defaultReason;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-red-100">
        <AlertCircle size={36} className="text-red-600" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-950">Verificación rechazada</h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-500 leading-relaxed">
        Tu documentación no pudo ser verificada. Revisá los motivos y volvé a intentarlo con
        documentos más claros.
      </p>

      <div className="mt-8 w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-5 text-left">
        <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">Motivo del rechazo</p>
        <p className="text-sm text-red-800 leading-relaxed">{reason}</p>
      </div>

      <div className="mt-8 w-full max-w-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Antes de reintentar, asegurate de:</p>
        {[
          "Fotografiar el DNI en un lugar con buena luz",
          "Que los datos sean claramente legibles",
          "Que la selfie muestre tu rostro completo",
          "Evitar reflejos o sombras en las fotos",
        ].map((tip) => (
          <div key={tip} className="flex items-start gap-2 text-sm text-zinc-600">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            {tip}
          </div>
        ))}
      </div>

      <Button onClick={handleRetry} className="mt-8 h-11 px-8">
        <RefreshCw size={15} />
        Reintentar verificación
      </Button>

      <p className="mt-4 text-xs text-zinc-400">
        ¿Necesitás ayuda?{" "}
        <a href="mailto:soporte@escencial.com" className="font-semibold text-zinc-700 hover:underline">
          Contactanos
        </a>
      </p>
    </div>
  );
}
