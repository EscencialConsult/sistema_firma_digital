import { CheckCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { supabase } from "../../shared/lib/supabase";

const TERMS_TEXT = `
TÉRMINOS Y CONDICIONES DE USO

1. Aceptación de los Términos
Al acceder y utilizar la plataforma Firma Digital Portal (en adelante, "la Plataforma"), el usuario acepta los presentes Términos y Condiciones de Uso. Si no estuviese de acuerdo con alguno de ellos, deberá abstenerse de utilizar la Plataforma.

2. Objeto
La Plataforma permite la creación, envío, gestión y firma electrónica de documentos con validez legal, así como la verificación de identidad (KYC) y la emisión de certificados digitales.

3. Registro y Seguridad
Para utilizar la Plataforma, el usuario deberá registrarse proporcionando datos exactos y verdaderos. Es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta.

4. Firma Electrónica
Las firmas realizadas a través de la Plataforma tienen validez legal conforme a la Ley N° 25.506 de Firma Digital de la República Argentina y normativa complementaria.

5. Verificación de Identidad
El usuario se compromete a proporcionar documentación válida y actualizada para el proceso de verificación de identidad (KYC). La Plataforma se reserva el derecho de solicitar información adicional.

6. Privacidad y Datos Personales
Los datos personales serán tratados conforme a la Ley N° 25.326 de Protección de Datos Personales. El usuario autoriza el almacenamiento y procesamiento de sus datos para los fines de la Plataforma.

7. Propiedad Intelectual
Todos los derechos de propiedad intelectual sobre la Plataforma, su diseño, código fuente, marcas y contenidos pertenecen a Escencial Consultora S.A.S.

8. Limitación de Responsabilidad
La Plataforma no será responsable por daños derivados del uso indebido, fallas técnicas ajenas a su control, o incumplimientos del usuario.

9. Vigencia y Modificaciones
Estos términos rigen a partir de su aceptación. La Plataforma podrá modificarlos, notificando al usuario con antelación.

10. Jurisdicción
Cualquier controversia se someterá a los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, República Argentina.
`;

export function ConformityPage() {
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user?.termsAcceptedAt) {
    return <Navigate to="/" replace />;
  }

  async function handleAccept() {
    if (!user) return;
    setAccepting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await reloadUser();
      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al aceptar los términos."
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-950">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-950 leading-none">Firma Digital</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Términos y condiciones</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 hidden sm:block truncate max-w-[200px]">
            {user?.email}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-950">
              Términos y Condiciones de Uso
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Leé atentamente los términos antes de aceptarlos. Esta aceptación es
              necesaria para poder operar en la plataforma.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 leading-relaxed">
              {TERMS_TEXT}
            </pre>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span className="text-sm text-zinc-700 leading-relaxed">
              <span className="font-semibold">Leí y acepto</span> los Términos y
              Condiciones de Uso de la plataforma Firma Digital Portal, incluyendo
              las políticas de privacidad y tratamiento de datos personales.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleAccept}
              disabled={!checked || accepting}
              className="h-12 flex-1 text-base"
            >
              <CheckCircle size={16} />
              {accepting ? "Aceptando términos..." : "Aceptar términos y continuar"}
            </Button>
          </div>

          <p className="text-center text-xs text-zinc-400">
            Al hacer clic en "Aceptar términos y continuar" aceptás los términos
            descritos arriba. Esta acción quedará registrada.
          </p>
        </div>
      </main>
    </div>
  );
}