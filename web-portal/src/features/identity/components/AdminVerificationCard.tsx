import { Eye } from "lucide-react";
import { Button } from "../../../shared/components/ui/Button";
import { IdentityStatusBadge } from "./IdentityStatusBadge";
import type { IdentityVerification } from "../types/identity.types";

export function AdminVerificationCard({ verification, onOpen, isSelected }: { verification: IdentityVerification; onOpen: () => void; isSelected?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01),0_10px_40px_-15px_rgba(0,0,0,0.04)] hover-lift transition-all cursor-pointer ${
      isSelected 
        ? "border-zinc-950 bg-zinc-50/50 ring-1 ring-zinc-950" 
        : "border-zinc-200/50 bg-white hover:bg-zinc-50/20"
    }`} onClick={onOpen}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-zinc-950">{verification.fullName ?? "Sin nombre"}</p>
          <p className="mt-1 text-xs text-zinc-500 font-medium">{verification.documentType} {verification.documentNumber}</p>
        </div>
        <IdentityStatusBadge status={verification.status} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" type="button" onClick={onOpen} className="h-8 text-xs px-3 rounded-lg"><Eye size={14} /> Revisar</Button>
      </div>
    </div>
  );
}

