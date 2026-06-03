import type { Dispatch, SetStateAction } from "react";
import type { PersonalData } from "../types/identity.types";

const fields: Array<{ key: keyof PersonalData; label: string; placeholder?: string; type?: string; optional?: boolean }> = [
  { key: "fullName", label: "Nombre completo" },
  { key: "documentType", label: "Tipo de documento" },
  { key: "documentNumber", label: "Numero de documento" },
  { key: "birthDate", label: "Fecha de nacimiento", type: "date" },
  { key: "nationality", label: "Nacionalidad" },
  { key: "country", label: "Pais" },
  { key: "province", label: "Provincia" },
  { key: "city", label: "Ciudad" },
  { key: "address", label: "Domicilio", optional: true },
  { key: "phone", label: "Telefono" },
  { key: "email", label: "Email", type: "email" },
  { key: "cuitCuil", label: "CUIT/CUIL", optional: true }
];

export function PersonalDataStep({ value, onChange }: { value: PersonalData; onChange: Dispatch<SetStateAction<PersonalData>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <label key={field.key} className="text-sm font-medium text-zinc-700">
          {field.label}{field.optional ? <span className="text-zinc-400"> opcional</span> : null}
          <input
            className="mt-2 w-full rounded-xl border border-zinc-200/80 px-4 py-2.5 text-sm outline-none focus:border-zinc-400 transition"
            type={field.type ?? "text"}
            value={value[field.key] ?? ""}
            placeholder={field.placeholder}
            onChange={(event) => onChange((current) => ({ ...current, [field.key]: event.target.value }))}
          />
        </label>
      ))}
    </div>
  );
}

