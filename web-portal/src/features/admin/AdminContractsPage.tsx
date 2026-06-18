import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  Files,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "../../shared/components/ui/Toast";
import { Button } from "../../shared/components/ui/Button";
import { getAllContracts, createContract } from "../../shared/services/contracts.service";
import { getAllUsers } from "../../shared/services/admin.service";
import type { Contract, ContractStatus } from "../../shared/types/contract";
import type { AdminUserSummary } from "../../shared/types/user";
import {
  CONTRACT_TEMPLATES,
  ContractTemplateDef,
  TemplateFieldDef,
  AlumnoData,
} from "../../shared/utils/contractTemplate";
import { ContractDocument, ContractDetailModal } from "./components/ContractRenderer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusMeta(status: ContractStatus) {
  switch (status) {
    case "SIGNED":
    case "COMPLETED":
      return { label: "Firmado",  className: "text-emerald-400 bg-emerald-900/30 border-emerald-800" };
    case "SENT":
    case "VIEWED":
      return { label: "Pendiente", className: "text-amber-400 bg-amber-900/30 border-amber-800" };
    case "CONFORMITY_ACCEPTED":
      return { label: "Conformidad", className: "text-blue-400 bg-blue-900/20 border-blue-800" };
    case "REJECTED":
    case "EXPIRED":
      return { label: status === "REJECTED" ? "Rechazado" : "Vencido", className: "text-red-400 bg-red-900/20 border-red-800" };
    default:
      return { label: status, className: "text-zinc-400 bg-zinc-800 border-zinc-700" };
  }
}

const ACCENT_CLASSES = {
  blue:    { border: "border-blue-700",   bg: "bg-blue-900/20",   badge: "bg-blue-900/30 text-blue-300 border-blue-800",   ring: "ring-blue-600"   },
  amber:   { border: "border-amber-700",  bg: "bg-amber-900/20",  badge: "bg-amber-900/30 text-amber-300 border-amber-800", ring: "ring-amber-600"  },
  emerald: { border: "border-emerald-700",bg: "bg-emerald-900/20",badge: "bg-emerald-900/30 text-emerald-300 border-emerald-800", ring: "ring-emerald-600" },
  purple:  { border: "border-purple-700", bg: "bg-purple-900/20", badge: "bg-purple-900/30 text-purple-300 border-purple-800", ring: "ring-purple-600" },
  rose:    { border: "border-rose-700",   bg: "bg-rose-900/20",   badge: "bg-rose-900/30 text-rose-300 border-rose-800",   ring: "ring-rose-600"   },
};

// ─── Template field input ─────────────────────────────────────────────────────

function TemplateFieldInput({
  fieldKey,
  def,
  value,
  onChange,
}: {
  fieldKey: string;
  def: TemplateFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = "w-full rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition";

  if (def.type === "textarea") {
    return (
      <div className={def.span === "full" ? "col-span-2" : ""}>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">{def.label}</label>
        <textarea
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${base} px-4 py-3 resize-none`}
        />
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div className={def.span === "full" ? "col-span-2" : ""}>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">{def.label}</label>
        <select
          value={value || def.defaultValue || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} px-4 py-2.5`}
        >
          {def.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className={def.span === "full" ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-semibold text-zinc-400">{def.label}</label>
      <div className="flex overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 focus-within:border-zinc-500 transition">
        {def.prefix && (
          <span className="px-3 text-zinc-500 text-sm font-medium select-none flex items-center">{def.prefix}</span>
        )}
        <input
          type={def.type}
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent py-2.5 pr-4 pl-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
        />
      </div>
    </div>
  );
}

// ─── Alumno fields ────────────────────────────────────────────────────────────

function AlumnoField({
  label, value, type = "text", placeholder = "", onChange,
}: { label: string; value: string; type?: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-400">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition"
      />
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            i < current ? "bg-emerald-500 text-white" :
            i === current ? "bg-white text-zinc-900" :
            "bg-zinc-800 text-zinc-500"
          }`}>
            {i < current ? <Check size={9} /> : i + 1}
          </span>
          <span className={`hidden text-xs sm:inline ${i === current ? "font-semibold text-white" : "text-zinc-600"}`}>{label}</span>
          {i < labels.length - 1 && <ChevronRight size={11} className="text-zinc-700 mx-0.5" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_ALUMNO: AlumnoData = { nombre: "", email: "", dni: "", cuil: "", domicilio: "" };

export function AdminContractsPage() {
  // ── List state ──
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "pending" | "signed" | "rejected">("all");
  const [search, setSearch]       = useState("");
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  // ── Create flow state ──
  const [view, setView]           = useState<"list" | "create">("list");
  const [step, setStep]           = useState(0); // 0=pick template, 1=fields, 2=recipient, 3=preview
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateDef | null>(null);
  const [fields, setFields]       = useState<Record<string, string>>({});
  const [alumno, setAlumno]       = useState<AlumnoData>({ ...EMPTY_ALUMNO });
  const [users, setUsers]         = useState<AdminUserSummary[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [creating, setCreating]      = useState(false);
  const [created, setCreated]        = useState(false);
  const [showToast, setShowToast]    = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    getAllContracts().then((c) => { setContracts(c); setLoading(false); });
    getAllUsers().then((u) => setUsers(u));
  }, []);

  const filtered = useMemo(() => {
    let list = contracts;
    if (filter === "pending") list = list.filter((c) => ["SENT","VIEWED","CONFORMITY_ACCEPTED"].includes(c.status));
    else if (filter === "signed") list = list.filter((c) => ["SIGNED","COMPLETED"].includes(c.status));
    else if (filter === "rejected") list = list.filter((c) => ["REJECTED","EXPIRED"].includes(c.status));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.ownerEmail.toLowerCase().includes(q));
    }
    return list;
  }, [contracts, filter, search]);

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, userSearch]);

  function pickTemplate(tpl: ContractTemplateDef) {
    setSelectedTemplate(tpl);
    const defaults: Record<string, string> = {};
    Object.entries(tpl.fields).forEach(([k, def]) => {
      if (def.defaultValue) defaults[k] = def.defaultValue;
    });
    setFields(defaults);
    setStep(1);
  }

  function step1Valid() {
    if (!selectedTemplate) return false;
    return Object.keys(selectedTemplate.fields).every((k) => {
      const def = selectedTemplate.fields[k];
      if (def.defaultValue !== undefined) return true; // has default, optional
      return !!fields[k];
    });
  }

  function handleSelectUser(u: AdminUserSummary) {
    setSelectedUser(u);
    setAlumno((a) => ({ ...a, nombre: u.fullName, email: u.email }));
  }

  const step2Valid = selectedUser && alumno.nombre && alumno.email;

  async function handleConfirm() {
    if (!selectedTemplate) return;
    setCreating(true);
    try {
      // Merge template fields + signer personal data so ContractDocument can render them
      const templateFields: Record<string, string> = {
        ...fields,
        dni_firmante:       alumno.dni,
        cuil_firmante:      alumno.cuil,
        domicilio_firmante: alumno.domicilio,
      };

      const newContract = await createContract({
        title:          selectedTemplate.legalTitle,
        description:    `Firmante: ${alumno.nombre} (${alumno.email})`,
        templateId:     selectedTemplate.id,
        templateFields,
        signerEmail:    alumno.email,
        signerName:     alumno.nombre,
      });

      setContracts((c) => [newContract, ...c]);
      setCreated(true);
      setToastMessage(`Contrato enviado a ${alumno.nombre}`);
      setShowToast(true);
    } catch (err) {
      console.error("[AdminContracts] Error al crear contrato:", err);
    } finally {
      setCreating(false);
    }
  }

  // Auto-redirect to list after successful creation
  useEffect(() => {
    if (!created) return;
    redirectTimerRef.current = setTimeout(() => {
      exitCreate();
    }, 2500);
    return () => clearTimeout(redirectTimerRef.current);
  }, [created]);

  function resetCreate() {
    setStep(0);
    setSelectedTemplate(null);
    setFields({});
    setAlumno({ ...EMPTY_ALUMNO });
    setSelectedUser(null);
    setUserSearch("");
    setCreated(false);
  }

  function exitCreate() {
    resetCreate();
    setView("list");
  }

  // ── Create view ──
  if (view === "create") {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={exitCreate}
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Contratos</p>
            <h2 className="font-bold text-white">
              {selectedTemplate ? selectedTemplate.name : "Nuevo contrato"}
            </h2>
          </div>
          {step > 0 && !created && (
            <div className="ml-auto">
              <Steps
                current={step - 1}
                labels={["Completar datos", "Destinatario", "Vista previa"]}
              />
            </div>
          )}
        </div>

        {created ? (
          /* ── Success ── */
          <div className="flex flex-col items-center py-20 text-center max-w-sm mx-auto">
            <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-emerald-900/30 border border-emerald-700">
              <Check size={36} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">¡Contrato enviado!</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Se envió el contrato a <strong className="text-zinc-300">{alumno.nombre}</strong> ({alumno.email}).
            </p>
            {selectedTemplate && (
              <p className="mt-1 text-xs text-zinc-600 italic">{selectedTemplate.legalTitle}</p>
            )}
            <div className="mt-8 flex gap-3">
              <Button onClick={exitCreate} className="h-10 px-5">Ver contratos</Button>
              <Button variant="secondary" onClick={() => { resetCreate(); }} className="h-10 px-5 text-zinc-700">
                Nuevo contrato
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Step 0: Template picker ── */}
            {step === 0 && (
              <div className="space-y-5">
                <p className="text-sm text-zinc-400">
                  Seleccioná el tipo de contrato. Cada template genera el documento legal correspondiente.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {CONTRACT_TEMPLATES.map((tpl) => {
                    const ac = ACCENT_CLASSES[tpl.accent];
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => pickTemplate(tpl)}
                        className={`group flex flex-col gap-3 rounded-2xl border p-5 text-left transition hover:scale-[1.01] active:scale-[0.99] ${ac.border} ${ac.bg} hover:brightness-110`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ac.badge}`}>
                            {tpl.category}
                          </span>
                          <ChevronRight size={14} className="text-zinc-500 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{tpl.name}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-500 italic leading-snug">{tpl.legalTitle}</p>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{tpl.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 1: Fill template fields ── */}
            {step === 1 && selectedTemplate && (
              <div className="space-y-5 max-w-2xl">
                <div className={`rounded-xl border p-3 flex items-center gap-3 ${ACCENT_CLASSES[selectedTemplate.accent].border} ${ACCENT_CLASSES[selectedTemplate.accent].bg}`}>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ACCENT_CLASSES[selectedTemplate.accent].badge}`}>
                    {selectedTemplate.category}
                  </span>
                  <p className="text-xs text-zinc-300 italic leading-snug flex-1">{selectedTemplate.legalTitle}</p>
                  <button
                    type="button"
                    onClick={() => { setStep(0); setSelectedTemplate(null); }}
                    className="text-[10px] text-zinc-500 underline hover:text-zinc-300 shrink-0"
                  >
                    Cambiar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(selectedTemplate.fields).map(([key, def]) => (
                    <TemplateFieldInput
                      key={key}
                      fieldKey={key}
                      def={def}
                      value={fields[key] ?? def.defaultValue ?? ""}
                      onChange={(v) => setFields((f) => ({ ...f, [key]: v }))}
                    />
                  ))}
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(0)} className="h-10 px-5 text-zinc-700">
                    <ArrowLeft size={14} /> Atrás
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={!step1Valid()} className="h-10 px-6">
                    Seleccionar destinatario <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Recipient ── */}
            {step === 2 && (
              <div className="space-y-5 max-w-2xl">
                <p className="text-sm text-zinc-400">
                  Buscá y seleccioná el destinatario del contrato, luego completá sus datos de identificación para el documento.
                </p>

                {/* User search */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">Buscar usuario registrado</label>
                  <div className="flex items-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 focus-within:border-zinc-500 transition">
                    <Search size={14} className="text-zinc-600" />
                    <input
                      className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
                      placeholder="Nombre o email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800">
                    {filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-800/60 ${selectedUser?.id === u.id ? "bg-zinc-800" : ""}`}
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
                          {u.fullName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-200 truncate">{u.fullName}</p>
                          <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        </div>
                        {selectedUser?.id === u.id && <Check size={14} className="text-emerald-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alumno identification fields */}
                <div className="grid grid-cols-2 gap-4">
                  <AlumnoField label="Nombre completo" value={alumno.nombre} onChange={(v) => setAlumno((a) => ({ ...a, nombre: v }))} />
                  <AlumnoField label="Email" value={alumno.email} onChange={(v) => setAlumno((a) => ({ ...a, email: v }))} />
                  <AlumnoField label="DNI *" value={alumno.dni} placeholder="40123456" onChange={(v) => setAlumno((a) => ({ ...a, dni: v }))} />
                  <AlumnoField label="CUIL / CUIT" value={alumno.cuil} placeholder="20-40123456-7" onChange={(v) => setAlumno((a) => ({ ...a, cuil: v }))} />
                </div>
                <AlumnoField label="Domicilio (opcional)" value={alumno.domicilio} placeholder="Av. Corrientes 1234, CABA" onChange={(v) => setAlumno((a) => ({ ...a, domicilio: v }))} />

                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(1)} className="h-10 px-5 text-zinc-700">
                    <ArrowLeft size={14} /> Atrás
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!step2Valid} className="h-10 px-6">
                    Ver contrato <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Preview ── */}
            {step === 3 && selectedTemplate && (
              <div className="space-y-5 max-w-3xl">
                <p className="text-sm text-zinc-400">
                  Revisá el contrato antes de enviarlo. Los datos en <strong className="text-blue-400">azul</strong> son los parámetros configurados.
                </p>
                <ContractDocument templateId={selectedTemplate.id} fields={fields} alumno={alumno} />
                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(2)} className="h-10 px-5 text-zinc-700">
                    <ArrowLeft size={14} /> Atrás
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={creating}
                    className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {creating ? "Enviando..." : <><Send size={14} /> Enviar contrato</>}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Toast
          message={toastMessage}
          type="success"
          visible={showToast}
          onClose={() => setShowToast(false)}
          duration={4000}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <>
      {viewContract && (
        <ContractDetailModal contract={viewContract} onClose={() => setViewContract(null)} />
      )}

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Contratos</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {contracts.length} contratos · 5 templates legales disponibles.
            </p>
          </div>
          <Button onClick={() => { resetCreate(); setView("create"); }} className="shrink-0 h-10 px-4 mt-1">
            <Plus size={15} /> Nuevo contrato
          </Button>
        </div>

        {/* Template quick-access row */}
        <div className="flex flex-wrap gap-2">
          {CONTRACT_TEMPLATES.map((tpl) => {
            const ac = ACCENT_CLASSES[tpl.accent];
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => { resetCreate(); pickTemplate(tpl); setView("create"); setStep(1); }}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110 ${ac.badge}`}
              >
                {tpl.name}
              </button>
            );
          })}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 focus-within:border-zinc-600">
            <Files size={15} className="shrink-0 text-zinc-600" />
            <input
              className="w-full bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
              placeholder="Buscar por título o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all","pending","signed","rejected"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === k ? "border-zinc-400 bg-zinc-700 text-white" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {k === "all" ? "Todos" : k === "pending" ? "Pendientes" : k === "signed" ? "Firmados" : "Rechazados"}
              </button>
            ))}
          </div>
        </div>

        {/* Contract list */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array(4).fill(null).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-800" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Files size={32} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Sin contratos en este estado</p>
              <button
                type="button"
                onClick={() => { resetCreate(); setView("create"); }}
                className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-300"
              >
                Crear el primero
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filtered.map((c) => {
                const { label, className } = statusMeta(c.status);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 px-5 py-4 hover:bg-zinc-800/30 transition sm:flex-row sm:items-center sm:justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-800">
                        <Files size={14} className="text-zinc-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-100 truncate">{c.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {c.ownerEmail} · v{c.versionNumber} · {new Date(c.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-600 hidden sm:inline">
                        {c.completedSigners}/{c.totalSigners} firmas
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewContract(c)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition opacity-0 group-hover:opacity-100"
                      >
                        <Eye size={11} /> Ver
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Toast
        message={toastMessage}
        type="success"
        visible={showToast}
        onClose={() => setShowToast(false)}
        duration={4000}
      />
    </>
  );
}
