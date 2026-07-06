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
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-bold transition-all duration-300 ${
                  active ? "shadow-sm" : ""
                } ${!done && !active ? "border-zinc-200 bg-zinc-100 text-zinc-500" : ""}`}
                style={
                  done
                    ? { background: "var(--brand-primary)", borderColor: "var(--brand-primary)", color: "var(--brand-primary-text)" }
                    : active
                    ? { background: "var(--brand-primary)", borderColor: "transparent", color: "var(--brand-primary-text)", boxShadow: "0 0 0 4px var(--brand-primary-soft)" }
                    : undefined
                }
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : <span>{i + 1}</span>}
              </div>
              <span
                className={`hidden max-w-[120px] text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:block ${
                  done ? "text-zinc-500" : !active ? "text-zinc-300" : ""
                }`}
                style={active ? { color: "var(--brand-primary)" } : undefined}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mt-[22px] h-px flex-1 transition-all duration-300"
                style={i < current ? { background: "var(--brand-primary)" } : { background: "#e4e4e7" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
