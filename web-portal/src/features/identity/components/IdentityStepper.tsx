import { Check } from "lucide-react";

const steps = ["Datos personales", "Documento", "Selfie", "Declaracion", "Terminos", "Revision final"];

export function IdentityStepper({ currentStep, onStepChange }: { currentStep: number; onStepChange: (step: number) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-6">
      {steps.map((step, index) => {
        const active = index === currentStep;
        const done = index < currentStep;
        return (
          <button
            key={step}
            className={`rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.98] ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : done ? "border-emerald-100 bg-emerald-50/40 text-emerald-800" : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50/50"}`}
            type="button"
            onClick={() => onStepChange(index)}
          >
            <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold ring-1 ring-current">
              {done ? <Check size={14} /> : index + 1}
            </span>
            <span className="text-sm font-semibold">{step}</span>
          </button>
        );
      })}
    </div>
  );
}

