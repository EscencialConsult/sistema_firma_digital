import {
  CheckCircle2,
  Clock3,
  FileSignature,
  Files,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { Button } from "../../shared/components/ui/Button";
import { getMySigningRequests } from "../../shared/services/signing.service";
import type { SigningRequest } from "../../shared/types/signing";

function statusColor(status: string) {
  switch (status) {
    case "SIGNED":
    case "COMPLETED":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "SENT":
    case "VIEWED":
    case "CONFORMITY_ACCEPTED":
    case "PENDING":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "REJECTED":
    case "EXPIRED":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-zinc-600 bg-zinc-50 border-zinc-200";
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    SENT: "Enviado",
    VIEWED: "Visto",
    CONFORMITY_ACCEPTED: "Conformidad aceptada",
    SIGNED: "Firmado",
    REJECTED: "Rechazado",
    EXPIRED: "Vencido",
    DRAFT: "Borrador",
    COMPLETED: "Completado",
    PENDING: "Pendiente",
  };
  return map[status] ?? status;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isActionable(r: SigningRequest) {
  return r.status === "PENDING" || r.status === "VIEWED" || r.status === "CONFORMITY_ACCEPTED";
}

export function DashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SigningRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = user?.email ?? "";

    if (!email) {
      setRequests([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMySigningRequests(email);
        if (mounted) setRequests(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [user?.email]);

  const pending = requests.filter(isActionable);
  const signed = requests.filter((r) => r.status === "SIGNED");
  const active = requests.filter((r) => r.status !== "SIGNED" && r.status !== "REJECTED");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-950">
          Hola, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Aca vas a encontrar tus contratos recibidos, solicitudes de firma y estado de cuenta.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Files,
            label: "Contratos totales",
            value: loading ? "-" : String(requests.length),
            color: "text-zinc-900",
            bg: "bg-zinc-100",
          },
          {
            icon: FileSignature,
            label: "Por firmar",
            value: loading ? "-" : String(pending.length),
            color: "text-amber-700",
            bg: "bg-amber-100",
          },
          {
            icon: CheckCircle2,
            label: "Firmados",
            value: loading ? "-" : String(signed.length),
            color: "text-emerald-700",
            bg: "bg-emerald-100",
          },
          {
            icon: Clock3,
            label: "En proceso",
            value: loading ? "-" : String(active.length),
            color: "text-blue-700",
            bg: "bg-blue-100",
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm"
          >
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${bg}`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-950">{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <p className="font-semibold text-zinc-950">Mis contratos</p>
              <p className="text-xs text-zinc-500">Documentos recibidos y firmados por tu cuenta</p>
            </div>
            <Link to="/signatures">
              <Button variant="secondary" className="h-8 px-3 text-xs">Ver todos</Button>
            </Link>
          </div>

          {loading ? (
            <div className="p-5 text-sm text-zinc-400">Cargando...</div>
          ) : error ? (
            <div className="p-5 text-sm font-medium text-red-600">{error}</div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-5">
              <Files size={32} className="text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-500">Sin contratos todavia</p>
              <p className="text-xs text-zinc-400 mt-1">
                Cuando recibas un contrato para firmar, va a aparecer aca.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {requests.slice(0, 5).map((r) => (
                <Link
                  key={r.id}
                  to={`/signing/${r.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50/60 transition"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{r.documentTitle}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {r.status === "SIGNED" && r.signedAt
                        ? `Firmado ${formatDate(r.signedAt)}`
                        : `Recibido ${formatDate(r.sentAt)}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor(r.status)}`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="font-semibold text-zinc-950">Firmas pendientes</p>
            <p className="text-xs text-zinc-500">Documentos que esperan tu firma</p>
          </div>
          {loading ? (
            <div className="p-5 text-sm text-zinc-400">Cargando...</div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-5">
              <ShieldCheck size={32} className="text-emerald-300 mb-2" />
              <p className="text-sm font-semibold text-zinc-500">Todo al dia</p>
              <p className="text-xs text-zinc-400 mt-1">No tenes firmas pendientes.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {pending.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {r.documentTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Vence {formatDate(r.expiresAt)}
                  </p>
                  <Link to={`/signing/${r.id}`} className="mt-2 block">
                    <Button className="h-8 w-full text-xs">
                      <FileSignature size={13} /> Firmar ahora
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
