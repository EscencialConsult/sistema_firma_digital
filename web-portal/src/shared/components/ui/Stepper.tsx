import { Check } from "lucide-react";

type StepperProps = {
  steps: readonly string[];
  current: number;
};

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5 min-w-0 relative">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? "bg-zinc-900 text-white"
                    : active
                    ? "bg-zinc-900 text-white ring-4 ring-zinc-200"
                    : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : <span>{i + 1}</span>}
              </div>
              <span
                className={`text-[10px] font-semibold text-center uppercase tracking-wide whitespace-nowrap hidden sm:block ${
                  active ? "text-zinc-900" : done ? "text-zinc-500" : "text-zinc-300"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 mx-3 mb-5 transition-all ${
                  i < current ? "bg-zinc-900" : "bg-zinc-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
