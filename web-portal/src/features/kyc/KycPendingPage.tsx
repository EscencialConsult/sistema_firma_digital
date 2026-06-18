import { Clock } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";
import { useAuth } from "../../app/providers/AuthProvider";

export function KycPendingPage() {
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`kyc-pending-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "identity_verifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const status = (payload.new as { status: string }).status;
          if (status === "VERIFIED") {
            await reloadUser();
            navigate("/dashboard", { replace: true });
          } else if (status === "REJECTED") {
            navigate("/kyc/rejected", { replace: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate, reloadUser]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-amber-100">
        <Clock size={36} className="text-amber-600" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-950">Verificación en proceso</h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-500 leading-relaxed">
        Recibimos tu documentación y estamos revisándola. Esto puede demorar hasta{" "}
        <span className="font-semibold text-zinc-700">48 horas hábiles</span>.
        Te notificaremos por email cuando esté lista.
      </p>

      <div className="mt-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 text-left space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Estado del proceso</p>
        {[
          { label: "Documentos recibidos", done: true },
          { label: "Revisión en curso", done: false, active: true },
          { label: "Aprobación final", done: false },
        ].map(({ label, done, active }) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                done ? "bg-emerald-500" : active ? "animate-pulse bg-amber-500" : "bg-zinc-200"
              }`}
            />
            <p className={`text-sm ${done || active ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-zinc-400">
        Esta página se actualiza automáticamente cuando tu verificación es aprobada.
      </p>

      <p className="mt-2 text-xs text-zinc-400">
        ¿Tenés dudas?{" "}
        <a href="mailto:soporte@escencial.com" className="font-semibold text-zinc-700 hover:underline">
          Contactanos
        </a>
      </p>
    </div>
  );
}
