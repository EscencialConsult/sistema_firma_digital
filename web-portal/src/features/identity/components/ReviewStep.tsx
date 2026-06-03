import { CheckCircle2, FileImage, UserRound } from "lucide-react";
import type { IdentityDocumentType, PersonalData } from "../types/identity.types";

export function ReviewStep({ personalData, files, declarationAccepted }: { personalData: PersonalData; files: Record<IdentityDocumentType, File | null>; declarationAccepted: boolean }) {
  const rows = [
    ["Nombre", personalData.fullName],
    ["Documento", `${personalData.documentType} ${personalData.documentNumber}`],
    ["Nacimiento", personalData.birthDate],
    ["Email", personalData.email],
    ["Telefono", personalData.phone]
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200/50 p-5 bg-zinc-50/20">
        <div className="mb-4 flex items-center gap-2 font-bold text-zinc-950"><UserRound size={18} className="text-zinc-500" /> Datos</div>
        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-zinc-500 font-medium">{label}</dt>
              <dd className="font-semibold text-zinc-800">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-2xl border border-zinc-200/50 p-5 bg-zinc-50/20">
        <div className="mb-4 flex items-center gap-2 font-bold text-zinc-950"><FileImage size={18} className="text-zinc-500" /> Archivos</div>
        <ul className="space-y-2 text-sm text-zinc-600 font-medium">
          <li>Frente: <span className="font-semibold text-zinc-800">{files.DOCUMENT_FRONT?.name ?? "pendiente"}</span></li>
          <li>Dorso: <span className="font-semibold text-zinc-800">{files.DOCUMENT_BACK?.name ?? "pendiente"}</span></li>
          <li>Selfie: <span className="font-semibold text-zinc-800">{files.SELFIE?.name ?? "pendiente"}</span></li>
        </ul>
        <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> Declaración {declarationAccepted ? "aceptada" : "pendiente"}
        </p>
      </div>
    </div>
  );
}

