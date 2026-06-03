import type { LucideIcon } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <Icon size={22} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      {action ? <Button className="mt-5" type="button">{action}</Button> : null}
    </div>
  );
}

