export const declarationText = "Declaro bajo juramento que los datos ingresados son verdaderos, que el documento adjunto me pertenece y que soy la persona que realizara la firma o declaracion de conformidad dentro de la plataforma.";

export function DeclarationStep({ accepted, onAcceptedChange }: { accepted: boolean; onAcceptedChange: (accepted: boolean) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200/50 bg-zinc-50/30 p-5 text-sm leading-relaxed text-zinc-700">
        {declarationText}
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-zinc-200/50 bg-white p-5 text-sm text-zinc-700 select-none cursor-pointer hover:bg-zinc-50/50 transition duration-150">
        <input className="mt-1 accent-zinc-900 cursor-pointer" type="checkbox" checked={accepted} onChange={(event) => onAcceptedChange(event.target.checked)} />
        Acepto la declaración jurada de identidad y autorizo la revisión manual de la documentación cargada.
      </label>
    </div>
  );
}

