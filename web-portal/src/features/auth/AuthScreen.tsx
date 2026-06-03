import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

type AuthMode = "login" | "register";

const benefits = [
  "Auditoria completa",
  "Identidad validada",
  "Documentos trazables"
];

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <main className="min-h-screen bg-zinc-50/50 flex items-center justify-center p-4 md:p-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.01),0_30px_70px_-15px_rgba(0,0,0,0.06)] lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden bg-zinc-950 p-12 lg:block text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.15),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(39,39,42,0.4),transparent_50%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="mb-10 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-white shadow-sm">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight">Firma Digital Portal</p>
                  <p className="text-xs text-zinc-400">Firma e identidad digital segura</p>
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Plataforma segura B2B</p>
              <h1 className="mt-4 max-w-md text-3xl font-extrabold leading-tight tracking-tight">
                Firma documentos con total seguridad y validez legal.
              </h1>

              <div className="mt-8 grid gap-3 max-w-sm">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs font-medium text-zinc-200">
                    <CheckCircle2 className="text-emerald-400" size={16} />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            <p className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-zinc-400 max-w-sm">
              Acceso seguro y auditado para operar tus documentos, certificados y flujos de conformidad legal desde el navegador.
            </p>
          </div>
        </section>

        <section className="bg-zinc-50/20 px-6 py-12 text-zinc-950 sm:px-10 lg:px-12 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-7 lg:hidden">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-zinc-950 text-white">
                <ShieldCheck size={22} />
              </div>
              <h1 className="text-2xl font-bold">Firma Digital Portal</h1>
              <p className="mt-2 text-sm text-zinc-600">Accede a tu espacio seguro.</p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl border border-zinc-200/60 bg-zinc-50 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <button
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all duration-150 ${mode === "login" ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/20" : "text-zinc-500 hover:text-zinc-900"}`}
                type="button"
                onClick={() => setMode("login")}
              >
                Iniciar sesión
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all duration-150 ${mode === "register" ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/20" : "text-zinc-500 hover:text-zinc-900"}`}
                type="button"
                onClick={() => setMode("register")}
              >
                Crear cuenta
              </button>
            </div>

            {mode === "login" ? <LoginPage onCreateAccount={() => setMode("register")} /> : <RegisterPage onLogin={() => setMode("login")} />}
          </div>
        </section>
      </div>
    </main>
  );
}
