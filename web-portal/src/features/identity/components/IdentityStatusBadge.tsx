import type { IdentityStatus } from "../types/identity.types";

const labels: Record<IdentityStatus, string> = {
  PENDING: "Pendiente",
  IN_REVIEW: "En revision",
  VERIFIED: "Verificada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida"
};

const styles: Record<IdentityStatus, string> = {
  PENDING: "bg-zinc-100 text-zinc-700 ring-zinc-200/50",
  IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-100",
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-100",
  EXPIRED: "bg-orange-50 text-orange-700 ring-orange-100"
};

export function IdentityStatusBadge({ status }: { status: IdentityStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${styles[status]}`}>{labels[status]}</span>;
}

