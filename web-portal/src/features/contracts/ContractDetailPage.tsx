import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileSignature,
  Hash,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../shared/components/ui/Button";
import { getContractById } from "../../shared/services/contracts.service";
import type { ContractDetail, ContractSigner } from "../../shared/types/contract";

function signerStatus(status: ContractSigner["status"]) {
  switch (status) {
    case "SIGNED":
      return { label: "Firmado", className: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 };
    case "CONFORMITY_ACCEPTED":
      return { label: "Conformidad aceptada", className: "text-blue-700 bg-blue-50 border-blue-200", icon: Clock3 };
    case "VIEWED":
      return { label: "Visto", className: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock3 };
    case "REJECTED":
      return { label: "Rechazado", className: "text-red-700 bg-red-50 border-red-200", icon: XCircle };
    default:
      return { label: "Pendiente", className: "text-zinc-600 bg-zinc-50 border-zinc-200", icon: Clock3 };
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getContractById(id).then((c) => {
      setContract(c);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
        Cargando contrato...
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-lg font-semibold text-zinc-700">Contrato no encontrado</p>
        <Link to="/contracts" className="mt-4">
          <Button variant="secondary">
            <ArrowLeft size={15} /> Volver
          </Button>
        </Link>
      </div>
    );
  }

  const pendingSigner = contract.signers.find(
    (s) => s.status === "PENDING" || s.status === "VIEWED"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 transition"
          type="button"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Contrato</p>
          <h1 className="mt-1 text-xl font-bold text-zinc-950 leading-snug">{contract.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{contract.description}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* PDF preview */}
        <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="font-semibold text-zinc-950">Documento</p>
            <p className="text-xs text-zinc-400">{contract.fileName}</p>
          </div>
          <div className="flex h-72 flex-col items-center justify-center bg-zinc-50 text-center px-8">
            <FileSignature size={40} className="text-zinc-300 mb-3" />
            <p className="text-sm font-semibold text-zinc-500">Vista previa no disponible</p>
            <p className="mt-1 text-xs text-zinc-400">
              Cuando el sistema se conecte a Supabase Storage, el PDF se mostrará acá.
            </p>
          </div>
        </div>

        {/* Sidebar: info + signers */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Información</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Hash size={14} className="mt-0.5 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-xs text-zinc-400">Hash SHA-256</p>
                  <p className="font-mono text-[11px] text-zinc-600 break-all">
                    {contract.sha256Hash.slice(0, 32)}...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>Versión {contract.versionNumber}</span>
                <span>·</span>
                <span>
                  {contract.completedSigners}/{contract.totalSigners} firmantes
                </span>
              </div>
            </div>
          </div>

          {/* Signers */}
          <div className="rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Firmantes</p>
            {contract.signers.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin firmantes asignados</p>
            ) : (
              <div className="space-y-3">
                {contract.signers.map((signer) => {
                  const { label, className, icon: Icon } = signerStatus(signer.status);
                  return (
                    <div key={signer.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-full bg-zinc-100">
                          <User size={13} className="text-zinc-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">
                            {signer.name}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">{signer.email}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${className}`}
                      >
                        <Icon size={11} />
                        {label}
                      </span>
                      {signer.signedAt && (
                        <p className="text-[11px] text-zinc-400">
                          Firmado: {formatDate(signer.signedAt)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CTA: sign if pending */}
          {pendingSigner && (
            <Link to={`/signing/sr-001`}>
              <Button className="h-11 w-full">
                <FileSignature size={15} />
                Firmar este documento
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
