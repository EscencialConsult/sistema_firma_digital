import { UserCircle, ShieldCheck, Award, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { usersApi } from "./services/users.api";
import { Button } from "../../shared/components/ui/Button";
import { Card, CardHeader } from "../../shared/components/ui/Card";
import { PageHeader } from "../../shared/components/ui/PageHeader";

export function ProfilePage() {
  const { user, reloadUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when user object is loaded
  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="grid min-h-[300px] place-items-center text-zinc-500">
        <p className="text-sm font-semibold">Cargando perfil de cuenta segura...</p>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim() === user?.fullName) return;

    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      await usersApi.updateMe(fullName.trim());
      await reloadUser();
      setSuccess(true);
      
      // Auto-hide success badge after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al actualizar los datos del perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader 
        eyebrow="Cuenta" 
        title="Perfil de Usuario" 
        description="Gesti?ne la información de su cuenta y revise sus estados de validación criptográfica." 
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card Left: Visual Status Summary */}
        <Card className="md:col-span-1 p-5 flex flex-col items-center text-center justify-between border border-zinc-200/50 bg-white">
          <div className="space-y-4 w-full">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-zinc-950 text-white font-bold text-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-zinc-950 text-base">{user.fullName}</h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="w-full border-t border-zinc-100 pt-5 mt-5 space-y-3.5 text-xs text-left">
            {/* KYC status details */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-zinc-400" /> Estado KYC
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                user.verificationStatus === "VERIFIED"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : user.verificationStatus === "REJECTED"
                    ? "bg-rose-50 text-rose-700 ring-rose-100"
                    : user.verificationStatus === "IN_REVIEW"
                      ? "bg-amber-50 text-amber-700 ring-amber-100"
                      : "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
              }`}>
                {user.verificationStatus}
              </span>
            </div>

            {/* Cert status details */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                <Award size={14} className="text-zinc-400" /> Firma Digital
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                user.certificateStatus === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : "bg-zinc-100 text-zinc-700 ring-zinc-200/50"
              }`}>
                {user.certificateStatus}
              </span>
            </div>
          </div>
        </Card>

        {/* Profile Card Right: Interactive profile editing form */}
        <Card className="md:col-span-2 border border-zinc-200/50 bg-white">
          <CardHeader 
            title="Datos Personales" 
            subtitle="Modifique la información declarada en la plataforma de firmas." 
          />

          <form onSubmit={handleSave} className="p-5 space-y-5">
            {/* Success / Error alerts */}
            {success && (
              <div className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800 font-semibold items-center">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> Cambios guardados con éxito en su perfil.
              </div>
            )}
            {error && (
              <div className="flex gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs text-rose-800 font-semibold items-center">
                <AlertCircle size={14} className="text-rose-600 shrink-0" /> {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Nombre Completo</label>
                <input 
                  type="text"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 outline-none text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition font-medium text-zinc-800"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ingrese su nombre completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Email de Registro</label>
                <input 
                  type="email"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 outline-none text-sm text-zinc-400 font-mono cursor-not-allowed"
                  value={user.email}
                  disabled
                />
                <span className="text-[10px] text-zinc-400 block leading-normal mt-1">
                  El email es inmutable para asegurar la correlación de firmas e identidades previas.
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-5 flex justify-end">
              <Button 
                type="submit" 
                disabled={saving || !fullName.trim() || fullName.trim() === user.fullName}
                className="bg-zinc-950 text-white hover:bg-zinc-900 rounded-xl px-5 py-2 text-xs font-semibold"
              >
                <UserCircle size={15} /> {saving ? "Guardando..." : "Guardar Perfil"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
