import { statusLabel, statusTone } from "../../utils/status";

const tones = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
};

export function Badge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${tones[tone]}`}>
      {statusLabel(status)}
    </span>
  );
}

