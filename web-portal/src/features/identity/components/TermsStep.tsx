import { ShieldCheck } from "lucide-react";

const TERMS_TEXT = `
TÉRMINOS Y CONDICIONES DE USO

1. Aceptación de los Términos
Al acceder y utilizar la plataforma Firma Digital Portal, el usuario acepta los presentes Términos y Condiciones de Uso.

2. Objeto
La Plataforma permite la creación, envío, gestión y firma electrónica de documentos con validez legal, así como la verificación de identidad (KYC) y la emisión de certificados digitales.

3. Registro y Seguridad
El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso.

4. Firma Electrónica
Las firmas realizadas a través de la Plataforma tienen validez legal conforme a la Ley N° 25.506 de Firma Digital.

5. Verificación de Identidad
El usuario se compromete a proporcionar documentación válida y actualizada para el proceso KYC.

6. Privacidad y Datos Personales
Los datos personales serán tratados conforme a la Ley N° 25.326 de Protección de Datos Personales.

7. Propiedad Intelectual
Todos los derechos de propiedad intelectual pertenecen a Escencial Consultora S.A.S.

8. Limitación de Responsabilidad
La Plataforma no será responsable por daños derivados del uso indebido.

9. Vigencia y Modificaciones
Estos términos rigen a partir de su aceptación.

10. Jurisdicción
Cualquier controversia se someterá a los tribunales de la Ciudad Autónoma de Buenos Aires.
`;

export function TermsStep({
  accepted,
  onAcceptedChange,
}: {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/30 p-5 overflow-auto max-h-[320px]">
        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 leading-relaxed">
          {TERMS_TEXT}
        </pre>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200/50 bg-white p-5 text-sm text-zinc-700 select-none hover:bg-zinc-50/50 transition duration-150">
        <input
          type="checkbox"
          className="mt-1 accent-zinc-900 cursor-pointer"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <div className="space-y-1">
          <span className="font-semibold">Leí y acepto</span>
          <span>
            {" "}
            los Términos y Condiciones de Uso de la plataforma, incluyendo las
            políticas de privacidad y tratamiento de datos personales.
          </span>
        </div>
      </label>

      <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-xs text-zinc-500">
        <ShieldCheck size={14} className="shrink-0" />
        Esta aceptación quedará registrada con fecha, hora y tu sesión actual.
      </div>
    </div>
  );
}