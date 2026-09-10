import { useState } from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";

interface ApiCredentialModalProps {
  open:    boolean;
  label:   string;
  value:   string;
  onClose: () => void;
}

/**
 * Modal genérico para mostrar UNA sola vez un secreto recién generado
 * (secret de credencial de API o secreto HMAC de webhook). El valor no
 * queda recuperable después de cerrar este modal — sigue el mismo
 * lenguaje visual que el modal "Crear administrador" de OrganizationDetailPage.
 */
export function ApiCredentialModal({ open, label, value, onClose }: ApiCredentialModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function copyValue() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{label}</h2>
          <button type="button" onClick={onClose} className="text-zinc-600 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-xs text-amber-400 leading-relaxed">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Este valor no se vuelve a mostrar — copialo ahora. Si lo perdés, vas a tener que generar uno nuevo.</span>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
          <p className="break-all font-mono text-sm text-zinc-200">{value}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyValue}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition"
          >
            Ya lo copié, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
