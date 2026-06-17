import { Check } from "lucide-react";

type StepperProps = {
  steps: readonly string[];
  current: number;
};

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-start justify-between gap-0">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-start min-w-0">
            <div className="relative flex min-w-[74px] flex-col items-center gap-2">
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-bold transition-all duration-200 ${
                  done
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : active
                    ? "border-white bg-zinc-950 text-white shadow-sm ring-4 ring-zinc-200"
                    : "border-zinc-200 bg-zinc-100 text-zinc-500"
                }`}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : <span>{i + 1}</span>}
              </div>
              <span
                className={`hidden max-w-[120px] text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:block ${
                  active ? "text-zinc-950" : done ? "text-zinc-600" : "text-zinc-300"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mt-[22px] h-px flex-1 transition-all duration-200 ${
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
