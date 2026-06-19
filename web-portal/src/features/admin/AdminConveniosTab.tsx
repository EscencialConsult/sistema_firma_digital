import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import {
  getConvenios,
  assignConvenioRecipient,
  type ConvenioInfo,
} from "../../shared/services/contracts.service";
import {
  inviteAuthority,
  buildInviteUrl,
  type OrgAuthority,
} from "../../shared/services/authorities.service";

// ─── Status helpers ───────────────────────────────────────────────────────────

type ConvenioStatus = "waiting_authority" | "authority_signed" | "recipient_sent" | "completed";

function getConvenioStatus(c: ConvenioInfo): ConvenioStatus {
  if (c.recipientSigningStatus === "SIGNED")   return "completed";
  if (c.recipientEmail)                        return "recipient_sent";
  if (c.authoritySigningStatus === "SIGNED")   return "authority_signed";
  return "waiting_authority";
}

const STATUS_META: Record<ConvenioStatus, { label: string; color: string; icon: React.ReactNode }> = {
  waiting_authority: {
    label: "Esperando firma de autoridad",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    icon: <Clock size={11} />,
  },
  authority_signed: {
    label: "Autoridad firmó · Asignar destinatario",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    icon: <ShieldCheck size={11} />,
  },
  recipient_sent: {
    label: "Enviado al destinatario",
    color: "text-purple-700 bg-purple-50 border-purple-200",
    icon: <Clock size={11} />,
  },
  completed: {
    label: "Completado",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    icon: <Check size={11} />,
  },
};

// ─── ConvenioCard ─────────────────────────────────────────────────────────────

function ConvenioCard({
  convenio,
  onAssign,
}: {
  convenio: ConvenioInfo;
  onAssign: (c: ConvenioInfo) => void;
}) {
  const status = getConvenioStatus(convenio);
  const meta   = STATUS_META[status];

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{convenio.documentTitle}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Creado el {fmtDate(convenio.documentCreatedAt)}</p>
        </div>
        <span className={`shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-semibold uppercase tracking-wide">Autoridad provisional</span>
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
            convenio.authoritySigningStatus === "SIGNED"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-amber-700 bg-amber-50 border-amber-200"
          }`}>
            {convenio.authoritySigningStatus === "SIGNED" ? "Firmó" : "Pendiente"}
          </span>
        </div>
        <p className="text-sm font-medium text-zinc-900">{convenio.authorityName}</p>
        <p className="text-xs text-zinc-500">{convenio.authorityEmail}</p>
      </div>

      {convenio.recipientName && (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-semibold uppercase tracking-wide">Destinatario</span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
              convenio.recipientSigningStatus === "SIGNED"
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-purple-700 bg-purple-50 border-purple-200"
            }`}>
              {convenio.recipientSigningStatus === "SIGNED" ? "Firmó" : "Pendiente"}
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-900">{convenio.recipientName}</p>
          <p className="text-xs text-zinc-500">{convenio.recipientEmail}</p>
        </div>
      )}

      {status === "authority_signed" && (
        <Button onClick={() => onAssign(convenio)} className="w-full h-10 text-sm">
          <UserPlus size={14} /> Asignar destinatario
        </Button>
      )}
    </div>
  );
}

// ─── AssignRecipientModal ─────────────────────────────────────────────────────

function AssignRecipientModal({
  convenio,
  onClose,
  onAssigned,
}: {
  convenio: ConvenioInfo;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [dni,       setDni]       = useState("");
  const [cuil,      setCuil]      = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  async function handleAssign() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setError("");
    try {
      await assignConvenioRecipient(convenio.documentId, {
        name: name.trim(),
        email: email.trim(),
        dni:  dni.trim() || undefined,
        cuil: cuil.trim() || undefined,
        domicilio: domicilio.trim() || undefined,
      });
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { required?: boolean; placeholder?: string; type?: string }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-400">{label}{opts?.required ? " *" : ""}</label>
      <input
        type={opts?.type ?? "text"}
        value={value}
        placeholder={opts?.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-500 outline-none focus:border-zinc-500 transition"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-5">
        <div className="border-b border-zinc-100 pb-4">
          <h3 className="font-bold text-zinc-900">Asignar destinatario</h3>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">"{convenio.documentTitle}"</p>
        </div>
        <div className="space-y-4">
          {field("Nombre completo", name, setName, { required: true, placeholder: "Juan Pérez" })}
          {field("Email", email, setEmail, { required: true, placeholder: "juan@empresa.com", type: "email" })}
          <div className="grid grid-cols-2 gap-3">
            {field("DNI", dni, setDni, { placeholder: "40123456" })}
            {field("CUIL / CUIT", cuil, setCuil, { placeholder: "20-40123456-7" })}
          </div>
          {field("Domicilio (opcional)", domicilio, setDomicilio, { placeholder: "Av. Corrientes 1234, CABA" })}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 h-10 text-zinc-700">Cancelar</Button>
          <Button
            onClick={handleAssign}
            disabled={!name.trim() || !email.trim() || saving}
            className="flex-1 h-10"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><UserPlus size={14} /> Asignar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

const EMPTY_AUTH  = { fullName: "", email: "", cuil: "", notes: "" };
const EMPTY_CONV  = { titulo: "", objeto: "", clausulas: "", jurisdiccion: "Ciudad Autónoma de Buenos Aires" };

function ConvenioWizard({
  orgId,
  onBack,
  onCreated,
}: {
  orgId: string;
  onBack: () => void;
  onCreated: () => void;
}) {
  const [step,        setStep]    = useState<0 | 1 | 2>(0);
  const [authData,    setAuth]    = useState({ ...EMPTY_AUTH });
  const [convData,    setConv]    = useState({ ...EMPTY_CONV });
  const [creating,    setCreating] = useState(false);
  const [created,     setCreated]  = useState<OrgAuthority | null>(null);
  const [error,       setError]    = useState("");
  const [copied,      setCopied]   = useState(false);

  const step0Valid = authData.fullName.trim() && authData.email.trim();
  const step1Valid = convData.titulo.trim() && convData.objeto.trim();

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const authority = await inviteAuthority({
        organizationId: orgId,
        fullName:       authData.fullName.trim(),
        email:          authData.email.trim(),
        cuil:           authData.cuil.trim() || undefined,
        notes:          authData.notes.trim() || undefined,
        type:           "PROVISIONAL",
        convenioTitle:  convData.titulo.trim(),
        templateId:     "convenio_terceros",
        templateFields: {
          objeto_convenio:        convData.objeto.trim(),
          clausulas_adicionales:  convData.clausulas.trim(),
          jurisdiccion:           convData.jurisdiccion.trim() || "Ciudad Autónoma de Buenos Aires",
        },
      });
      setCreated(authority);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el convenio");
    } finally {
      setCreating(false);
    }
  }

  function handleCopyLink() {
    if (!created?.inviteToken) return;
    void navigator.clipboard.writeText(buildInviteUrl(created.inviteToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-500 outline-none focus:border-zinc-500 transition";
  const labelCls = "mb-1 block text-xs font-semibold text-zinc-400";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <p className="text-xs text-zinc-500">Nuevo convenio</p>
          <h2 className="font-bold text-zinc-900">
            {step === 0 && "Autoridad provisional"}
            {step === 1 && "Contenido del convenio"}
            {step === 2 && (created ? "Convenio creado" : "Confirmar")}
          </h2>
        </div>
        {step < 2 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs">
            {[0, 1].map((s) => (
              <span key={s} className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                s < step ? "bg-emerald-500 text-white" :
                s === step ? "bg-zinc-900 text-white" :
                "bg-zinc-100 text-zinc-400"
              }`}>
                {s < step ? <Check size={9} /> : s + 1}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Step 0: Autoridad */}
      {step === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
          <p className="text-xs text-zinc-500">
            Ingresá los datos de la persona que firmará el convenio como autoridad provisional.
            Le vas a enviar el enlace de firma manualmente.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nombre completo *</label>
              <input value={authData.fullName} onChange={(e) => setAuth(a => ({ ...a, fullName: e.target.value }))} className={inputCls} placeholder="Ej: María González" />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" value={authData.email} onChange={(e) => setAuth(a => ({ ...a, email: e.target.value }))} className={inputCls} placeholder="maria@empresa.com" />
            </div>
            <div>
              <label className={labelCls}>CUIL (opcional)</label>
              <input value={authData.cuil} onChange={(e) => setAuth(a => ({ ...a, cuil: e.target.value }))} className={inputCls} placeholder="27-35123456-4" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas internas (opcional)</label>
              <textarea value={authData.notes} onChange={(e) => setAuth(a => ({ ...a, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Contexto adicional sobre esta autoridad..." />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={() => setStep(1)} disabled={!step0Valid} className="h-10 px-6">
              Continuar <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Contenido del convenio */}
      {step === 1 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
          <p className="text-xs text-zinc-500">
            Completá el contenido del convenio. La autoridad provisional lo va a revisar y firmar antes de que puedas enviárselo a un destinatario.
          </p>
          <div>
            <label className={labelCls}>Título del convenio *</label>
            <input value={convData.titulo} onChange={(e) => setConv(c => ({ ...c, titulo: e.target.value }))} className={inputCls} placeholder="Ej: Convenio de Representación Comercial" />
          </div>
          <div>
            <label className={labelCls}>Objeto del convenio *</label>
            <textarea value={convData.objeto} onChange={(e) => setConv(c => ({ ...c, objeto: e.target.value }))} rows={4} className={`${inputCls} resize-none`} placeholder="Las partes acuerdan..." />
          </div>
          <div>
            <label className={labelCls}>Cláusulas adicionales (opcional)</label>
            <textarea value={convData.clausulas} onChange={(e) => setConv(c => ({ ...c, clausulas: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Condiciones de pago, plazos, exclusiones..." />
          </div>
          <div>
            <label className={labelCls}>Jurisdicción</label>
            <input value={convData.jurisdiccion} onChange={(e) => setConv(c => ({ ...c, jurisdiccion: e.target.value }))} className={inputCls} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-between pt-1">
            <Button variant="secondary" onClick={() => setStep(0)} className="h-10 px-5 text-zinc-700">
              <ArrowLeft size={14} /> Atrás
            </Button>
            <Button onClick={handleCreate} disabled={!step1Valid || creating} className="h-10 px-6">
              {creating
                ? <><Loader2 size={14} className="animate-spin" /> Creando...</>
                : <><Check size={14} /> Crear y generar enlace</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Éxito */}
      {step === 2 && created && (
        <div className="space-y-5">
          <div className="flex flex-col items-center py-8 text-center space-y-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
              <Check size={28} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">¡Convenio creado!</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Copiá el enlace y enviáselo a <strong>{created.fullName}</strong> para que lo revise y firme.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Enlace de firma para la autoridad</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <p className="text-xs font-mono text-zinc-600 truncate">
                  {created.inviteToken ? buildInviteUrl(created.inviteToken) : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!created.inviteToken}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                  copied
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              La autoridad va a poder firmar el convenio desde este enlace. Una vez que firme, vas a ver el convenio como "listo para asignar destinatario".
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={onCreated} variant="secondary" className="h-10 px-6 text-zinc-700">
              Ver convenios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Tab export ──────────────────────────────────────────────────────────

export function AdminConveniosTab({ orgId }: { orgId: string }) {
  const [view,        setView]      = useState<"list" | "create">("list");
  const [convenios,   setConvenios] = useState<ConvenioInfo[]>([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<ConvenioInfo | null>(null);

  function loadConvenios() {
    setLoading(true);
    setError(null);
    getConvenios()
      .then(setConvenios)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar convenios"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadConvenios(); }, []);

  if (view === "create") {
    return (
      <ConvenioWizard
        orgId={orgId}
        onBack={() => setView("list")}
        onCreated={() => { setView("list"); loadConvenios(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Convenios</p>
          <h2 className="font-bold text-zinc-900">Documentos con autoridad provisional</h2>
        </div>
        <Button onClick={() => setView("create")} className="h-10 px-4 text-sm">
          <Plus size={14} /> Nuevo convenio
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-zinc-300" />
        </div>
      )}

      {error && (
        <EmptyState icon={XCircle} title="Error al cargar" description={error} />
      )}

      {!loading && !error && convenios.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Sin convenios"
          description="Creá el primer convenio para comenzar el flujo de firma con una autoridad provisional."
        />
      )}

      {!loading && !error && convenios.length > 0 && (
        <div className="space-y-3">
          {convenios.map((c) => (
            <ConvenioCard
              key={c.documentId}
              convenio={c}
              onAssign={setAssignModal}
            />
          ))}
        </div>
      )}

      {assignModal && (
        <AssignRecipientModal
          convenio={assignModal}
          onClose={() => setAssignModal(null)}
          onAssigned={() => { setAssignModal(null); loadConvenios(); }}
        />
      )}
    </div>
  );
}
