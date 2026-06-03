import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Card, CardHeader } from "../../../shared/components/ui/Card";
import { IdentityStatusBadge } from "../components/IdentityStatusBadge";
import type { IdentityStatus } from "../types/identity.types";

export function IdentityStatusPage({ status, rejectionReason }: { status: IdentityStatus; rejectionReason?: string }) {
  const icon = status === "VERIFIED" ? <CheckCircle2 size={20} /> : status === "REJECTED" ? <AlertTriangle size={20} /> : <Clock3 size={20} />;
  return (
    <Card>
      <CardHeader title="Estado de verificacion" subtitle="Este estado define si el usuario puede firmar documentos." action={<IdentityStatusBadge status={status} />} />
      <div className="flex gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200/50">{icon}</div>
        <div>
          <p className="font-semibold text-zinc-950">
            {status === "VERIFIED" ? "Identidad verificada" : status === "REJECTED" ? "Revisión rechazada" : "Pendiente de revisión"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {status === "VERIFIED"
              ? "Ya podés firmar y declarar conformidad con tu identidad validada."
              : status === "REJECTED"
                ? `Motivo: ${rejectionReason ?? "El administrador solicitó corregir datos."}`
                : "Un administrador revisará la documentación cargada."}
          </p>
        </div>
      </div>
    </Card>
  );
}

