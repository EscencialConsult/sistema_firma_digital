import type { LucideIcon } from "lucide-react";

export function StatCard({ icon: Icon, label, value, detail, onClick }: { icon: LucideIcon; label: string; value: string; detail: string; onClick?: () => void }) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-500">
          <Icon size={19} />
        </div>
        <span className="text-[10px] font-semibold text-emerald-600 font-mono">{detail}</span>
      </div>
      <p className="mt-5 text-2xl font-bold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-400">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        className="w-full rounded-2xl border border-zinc-200/50 bg-white p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.01),0_10px_40px_-15px_rgba(0,0,0,0.04)] hover-lift cursor-pointer active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01),0_10px_40px_-15px_rgba(0,0,0,0.04)] hover-lift">
      {content}
    </div>
  );
}
