import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

