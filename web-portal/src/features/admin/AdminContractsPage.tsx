import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Eye,
  Files,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "../../shared/components/ui/Toast";
import { Button } from "../../shared/components/ui/Button";
import {
  getAllContracts,
  createContract,
  sendDocumentToThirdParty,
  assignContractToUser,
  updateContractFields,
} from "../../shared/services/contracts.service";
import { getOrgAuthorities, type OrgAuthority } from "../../shared/services/authorities.service";
import { getMyOrganization } from "../../shared/services/organizations.service";
import { getAllUsers } from "../../shared/services/admin.service";
import type { Contract } from "../../shared/types/contract";
import type { AdminUserSummary } from "../../shared/types/user";
import {
  CONTRACT_TEMPLATES,
  type ContractTemplateDef,
  type TemplateFieldDef,
} from "../../shared/utils/contractTemplate";
import { ContractDocument, ContractDetailModal } from "./components/ContractRenderer";
import { AdminConveniosTab } from "./AdminConveniosTab";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusMeta(status: string) {
  switch (status) {
    case "DRAFT":       return { label: "Borrador",    className: "text-zinc-600 bg-zinc-100 border-zinc-300" };
    case "SIGNED":
    case "COMPLETED":   return { label: "Firmado",     className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    case "SENT":
    case "VIEWED":      return { label: "Pendiente",   className: "text-amber-700 bg-amber-50 border-amber-200" };
    case "CONFORMITY_ACCEPTED": return { label: "Conformidad", className: "text-blue-700 bg-blue-50 border-blue-200" };
    case "REJECTED":    return { label: "Rechazado",   className: "text-red-700 bg-red-50 border-red-200" };
    case "EXPIRED":     return { label: "Vencido",     className: "text-red-700 bg-red-50 border-red-200" };
    default:            return { label: status,        className: "text-zinc-400 bg-zinc-50 border-zinc-200" };
  }
}

const ACCENT_CLASSES = {
  blue:    { border: "border-blue-200",   bg: "bg-blue-50",   badge: "bg-blue-100 text-blue-700 border-blue-800",   ring: "ring-blue-600"   },
  amber:   { border: "border-amber-200",  bg: "bg-amber-50",  badge: "bg-amber-100 text-amber-700 border-amber-800", ring: "ring-amber-600"  },
  emerald: { border: "border-emerald-200",bg: "bg-emerald-50",badge: "bg-emerald-100 text-emerald-700 border-emerald-800", ring: "ring-emerald-600" },
  purple:  { border: "border-purple-200", bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700 border-purple-800", ring: "ring-purple-600" },
  rose:    { border: "border-rose-200",   bg: "bg-rose-50",   badge: "bg-rose-100 text-rose-700 border-rose-800",   ring: "ring-rose-600"   },
};

// ─── Template field input ─────────────────────────────────────────────────────

function TemplateFieldInput({
  fieldKey, def, value, onChange,
}: { fieldKey: string; def: TemplateFieldDef; value: string; onChange: (v: string) => void }) {
  const base = "w-full rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition";

  if (def.type === "textarea") {
    return (
      <div className={def.span === "full" ? "col-span-2" : ""}>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">{def.label}</label>
        <textarea value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)}
          rows={3} className={`${base} px-4 py-3 resize-none`} />
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div className={def.span === "full" ? "col-span-2" : ""}>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">{def.label}</label>
        <select value={value || def.defaultValue || ""} onChange={(e) => onChange(e.target.value)} className={`${base} px-4 py-2.5`}>
          {def.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className={def.span === "full" ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-semibold text-zinc-400">{def.label}</label>
      <div className="flex overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-100 transition">
        {def.prefix && <span className="px-3 text-zinc-500 text-sm font-medium select-none flex items-center">{def.prefix}</span>}
        <input type={def.type} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent py-2.5 pr-4 pl-3 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none" />
      </div>
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
            i < current ? "bg-emerald-500 text-white" : i === current ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-500"
          }`}>
            {i < current ? <Check size={9} /> : i + 1}
          </span>
          <span className={`hidden text-xs sm:inline ${i === current ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>{label}</span>
          {i < labels.length - 1 && <ChevronRight size={11} className="text-zinc-700 mx-0.5" />}
        </div>
      ))}
    </div>
  );
}

// ─── Assign User Modal ────────────────────────────────────────────────────────

function AssignUserModal({
  contract,
  orgId,
  onClose,
  onAssigned,
}: {
  contract: Contract;
  orgId: string;
  onClose: () => void;
  onAssigned: (contractId: string) => void;
}) {
  const [authorities, setAuthorities]       = useState<OrgAuthority[]>([]);
  const [loadingAuth, setLoadingAuth]       = useState(true);
  const [selectedAuth, setSelectedAuth]     = useState<OrgAuthority | null>(null);
  const [authSearch, setAuthSearch]         = useState("");

  const [users, setUsers]                   = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers]     = useState(true);
  const [selectedUser, setSelectedUser]     = useState<AdminUserSummary | null>(null);
  const [userSearch, setUserSearch]         = useState("");

  const [submitting, setSubmitting]         = useState(false);
  const [done, setDone]                     = useState(false);
  const [error, setError]                   = useState("");

  useEffect(() => {
    getOrgAuthorities(orgId)
      .then((all) => setAuthorities(all.filter((a) => a.status === "ACTIVE" && a.type === "PERMANENT")))
      .finally(() => setLoadingAuth(false));
    getAllUsers()
      .then(setUsers)
      .finally(() => setLoadingUsers(false));
  }, [orgId]);

  const filteredAuth = useMemo(() => {
    if (!authSearch) return authorities;
    const q = authSearch.toLowerCase();
    return authorities.filter((a) => a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [authorities, authSearch]);

  const filteredUsers = useMemo(() => {
    const base = users.filter((u) => u.role === "USER" || u.role === "ORG_ADMIN");
    if (!userSearch) return base;
    const q = userSearch.toLowerCase();
    return base.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, userSearch]);

  async function handleAssign() {
    if (!selectedAuth || !selectedUser) return;
    setSubmitting(true);
    setError("");
    try {
      await assignContractToUser(
        contract.id,
        {
          email:     selectedUser.email,
          name:      selectedUser.fullName,
          dni:       selectedUser.documentNumber,
          cuil:      selectedUser.cuilCuit,
          domicilio: selectedUser.address,
        },
        {
          fullName:     selectedAuth.fullName,
          cuil:         selectedAuth.cuil ?? selectedAuth.cuit,
          email:        selectedAuth.email,
          signatureUrl: selectedAuth.signatureUrl,
        }
      );
      setDone(true);
      onAssigned(contract.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar");
    } finally {
      setSubmitting(false);
    }
  }

  const inputBase = "w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-500 outline-none";
  const searchBox = "flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 focus-within:border-zinc-400 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {done ? (
          <div className="text-center py-10 px-6 space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
              <Check size={24} className="text-emerald-600" />
            </div>
            <p className="font-bold text-zinc-900">Contrato asignado</p>
            <p className="text-sm text-zinc-500">
              <strong>{selectedUser?.fullName}</strong> verá el contrato pendiente en su panel.<br />
              Firma por Escencial: <strong>{selectedAuth?.fullName}</strong>.
            </p>
            <Button onClick={onClose} className="h-10 px-6 mt-2">Cerrar</Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-zinc-100 px-6 py-4 shrink-0">
              <h3 className="font-bold text-zinc-900">Asignar contrato</h3>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">"{contract.title}"</p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Sección 1: Autoridad firmante */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest">
                    1. Autoridad firmante por Escencial SAS
                  </p>
                </div>
                <div className={searchBox}>
                  <Search size={14} className="text-zinc-400 shrink-0" />
                  <input className={inputBase} placeholder="Buscar autoridad..." value={authSearch} onChange={(e) => setAuthSearch(e.target.value)} />
                </div>
                {loadingAuth ? (
                  <div className="space-y-2">{Array(2).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-50" />)}</div>
                ) : filteredAuth.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    {authorities.length === 0 ? "Sin autoridades PERMANENTES activas" : "Sin resultados"}
                  </p>
                ) : (
                  <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-36 overflow-y-auto">
                    {filteredAuth.map((a) => (
                      <button key={a.id} type="button" onClick={() => setSelectedAuth(a)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50 ${selectedAuth?.id === a.id ? "bg-emerald-50" : ""}`}>
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-800 text-[10px] font-bold text-white">
                          {a.fullName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{a.fullName}</p>
                          <p className="text-xs text-zinc-500 truncate">{a.cuil || a.email}</p>
                        </div>
                        {selectedAuth?.id === a.id && <Check size={13} className="text-emerald-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                {selectedAuth && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <Check size={13} className="text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-800 truncate">Seleccionado: {selectedAuth.fullName}</p>
                  </div>
                )}
              </div>

              {/* Sección 2: Destinatario */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Send size={13} className="text-zinc-500 shrink-0" />
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest">
                    2. Destinatario (quien firma)
                  </p>
                </div>
                <div className={searchBox}>
                  <Search size={14} className="text-zinc-400 shrink-0" />
                  <input className={inputBase} placeholder="Buscar usuario..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                </div>
                {loadingUsers ? (
                  <div className="space-y-2">{Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-50" />)}</div>
                ) : filteredUsers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-400">Sin usuarios</p>
                ) : (
                  <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-40 overflow-y-auto">
                    {filteredUsers.map((u) => (
                      <button key={u.id} type="button" onClick={() => setSelectedUser(u)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50 ${selectedUser?.id === u.id ? "bg-zinc-100" : ""}`}>
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-white">
                          {u.fullName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{u.fullName}</p>
                          <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        </div>
                        {selectedUser?.id === u.id && <Check size={13} className="text-emerald-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <Check size={13} className="text-emerald-600 shrink-0" />
                    <p className="text-xs font-semibold text-zinc-700 truncate">Seleccionado: {selectedUser.fullName}</p>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-100 px-6 py-4 flex gap-3 shrink-0">
              <Button variant="secondary" onClick={onClose} className="flex-1 h-10 text-zinc-700">Cancelar</Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedAuth || !selectedUser || submitting}
                className="flex-1 h-10"
              >
                {submitting ? "Asignando..." : <><Send size={14} /> Asignar y enviar</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Send to Third Party Modal ────────────────────────────────────────────────

function SendThirdPartyModal({
  contract, onClose, onSent,
}: { contract: Contract; onClose: () => void; onSent: (contractId: string) => void }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSend() {
    if (!name.trim() || !email.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendDocumentToThirdParty(contract.id, { name: name.trim(), email: email.trim() });
      setDone(true);
      onSent(contract.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-5">
        {done ? (
          <div className="text-center py-4 space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
              <Check size={24} className="text-emerald-600" />
            </div>
            <p className="font-bold text-zinc-900">Enviado a {name}</p>
            <p className="text-sm text-zinc-500">{email} recibirá el documento para firmar.</p>
            <Button onClick={onClose} className="h-10 px-6">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 pb-4">
              <h3 className="font-bold text-zinc-900">Enviar al tercero</h3>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">"{contract.title}"</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Nombre completo *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del firmante"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={onClose} className="flex-1 h-10 text-zinc-700">Cancelar</Button>
              <Button onClick={handleSend} disabled={!name.trim() || !email.trim() || sending} className="flex-1 h-10">
                {sending ? "Enviando..." : <><Send size={14} /> Enviar</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminContractsPage() {
  const [activeTab, setActiveTab] = useState<"contracts" | "convenios">("contracts");
  const [orgId, setOrgId]         = useState<string | null>(null);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "pending" | "signed" | "rejected">("all");
  const [search, setSearch]       = useState("");
  const [viewContract, setViewContract]     = useState<Contract | null>(null);
  const [sendThirdParty, setSendThirdParty] = useState<Contract | null>(null);
  const [assignTarget, setAssignTarget]     = useState<Contract | null>(null);
  const [hasActiveAuthority, setHasActiveAuthority] = useState<boolean | null>(null);

  // Create / edit flow
  const [view, setView]                     = useState<"list" | "create">("list");
  const [step, setStep]                     = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateDef | null>(null);
  const [fields, setFields]                 = useState<Record<string, string>>({});
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [creating, setCreating]             = useState(false);
  const [created, setCreated]               = useState(false);
  const [showToast, setShowToast]           = useState(false);
  const [toastMessage, setToastMessage]     = useState("");
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    getAllContracts().then((c) => { setContracts(c); setLoading(false); });
    getMyOrganization()
      .then((org) => {
        if (!org) { setHasActiveAuthority(false); return; }
        setOrgId(org.id);
        return getOrgAuthorities(org.id).then((auths) => {
          setHasActiveAuthority(auths.some((a) => a.status === "ACTIVE"));
        });
      })
      .catch(() => setHasActiveAuthority(null));
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

  function pickTemplate(tpl: ContractTemplateDef) {
    setSelectedTemplate(tpl);
    const defaults: Record<string, string> = {};
    Object.entries(tpl.fields).forEach(([k, def]) => { if (def.defaultValue) defaults[k] = def.defaultValue; });
    setFields(defaults);
    setStep(1);
  }

  function startEdit(contract: Contract) {
    const tpl = CONTRACT_TEMPLATES.find((t) => t.id === contract.templateId);
    if (!tpl) return;
    setEditingContract(contract);
    setSelectedTemplate(tpl);
    setFields({ ...(contract.templateFields ?? {}) });
    setStep(1);
    setView("create");
  }

  function step1Valid() {
    if (!selectedTemplate) return false;
    return Object.keys(selectedTemplate.fields).every((k) => {
      const def = selectedTemplate.fields[k];
      if (def.defaultValue !== undefined) return true;
      if (def.type === "date") return true;
      return !!fields[k];
    });
  }

  async function handleConfirm() {
    if (!selectedTemplate) return;
    setCreating(true);
    try {
      if (editingContract) {
        await updateContractFields(editingContract.id, { ...fields });
        setContracts((prev) =>
          prev.map((c) => c.id === editingContract.id ? { ...c, templateFields: { ...fields } } : c)
        );
        setToastMessage("Cambios guardados correctamente.");
      } else {
        const newContract = await createContract({
          title:          selectedTemplate.legalTitle,
          description:    selectedTemplate.name,
          templateId:     selectedTemplate.id,
          templateFields: { ...fields },
          signers:        [],
        });
        setContracts((c) => [newContract, ...c]);
        setToastMessage("Contrato guardado como borrador. Asignalo a un usuario desde la lista.");
      }
      setCreated(true);
      setShowToast(true);
    } catch (err) {
      console.error("[AdminContracts] Error:", err);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!created) return;
    redirectTimerRef.current = setTimeout(() => { exitCreate(); }, 3000);
    return () => clearTimeout(redirectTimerRef.current);
  }, [created]);

  function resetCreate() {
    setStep(0);
    setSelectedTemplate(null);
    setFields({});
    setCreated(false);
    setEditingContract(null);
  }

  function exitCreate() {
    resetCreate();
    setView("list");
  }

  // ── Create / Edit view ──
  if (view === "create") {
    const isEditing = !!editingContract;
    return (
      <div className="min-h-screen">
        <div className="mb-6 flex items-center gap-4">
          <button onClick={exitCreate} type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Contratos</p>
            <h2 className="font-bold text-zinc-900">
              {isEditing ? `Editar — ${selectedTemplate?.name}` : (selectedTemplate ? selectedTemplate.name : "Nuevo contrato")}
            </h2>
          </div>
          {step > 0 && !created && (
            <div className="ml-auto">
              <Steps current={step - 1} labels={["Completar datos", "Vista previa"]} />
            </div>
          )}
        </div>

        {created ? (
          <div className="flex flex-col items-center py-20 text-center max-w-sm mx-auto">
            <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
              <Check size={36} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">
              {isEditing ? "Cambios guardados" : "Contrato creado"}
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              {isEditing
                ? "Los campos del contrato fueron actualizados."
                : "Quedó guardado como borrador. Asignalo a un usuario desde la lista para enviarlo."}
            </p>
            {selectedTemplate && <p className="mt-4 text-xs text-zinc-600 italic">{selectedTemplate.legalTitle}</p>}
            <div className="mt-8 flex gap-3">
              <Button onClick={exitCreate} className="h-10 px-5">Ver contratos</Button>
              {!isEditing && (
                <Button variant="secondary" onClick={() => { resetCreate(); }} className="h-10 px-5 text-zinc-700">
                  Nuevo contrato
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Step 0: Template picker (solo si no editamos) */}
            {step === 0 && !isEditing && (
              <div className="space-y-5">
                <p className="text-sm text-zinc-400">Seleccioná el tipo de contrato.</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {CONTRACT_TEMPLATES.map((tpl) => {
                    const ac = ACCENT_CLASSES[tpl.accent];
                    return (
                      <button key={tpl.id} type="button" onClick={() => pickTemplate(tpl)}
                        className={`group flex flex-col gap-3 rounded-2xl border p-5 text-left transition hover:scale-[1.01] active:scale-[0.99] ${ac.border} ${ac.bg} hover:brightness-110`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ac.badge}`}>{tpl.category}</span>
                          <ChevronRight size={14} className="text-zinc-500 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 text-sm">{tpl.name}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-500 italic leading-snug">{tpl.legalTitle}</p>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{tpl.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 1: Fill fields */}
            {step === 1 && selectedTemplate && (
              <div className="space-y-5 max-w-2xl">
                <div className={`rounded-xl border p-3 flex items-center gap-3 ${ACCENT_CLASSES[selectedTemplate.accent].border} ${ACCENT_CLASSES[selectedTemplate.accent].bg}`}>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ACCENT_CLASSES[selectedTemplate.accent].badge}`}>
                    {selectedTemplate.category}
                  </span>
                  <p className="text-xs text-zinc-700 italic leading-snug flex-1">{selectedTemplate.legalTitle}</p>
                  {!isEditing && (
                    <button type="button" onClick={() => { setStep(0); setSelectedTemplate(null); }}
                      className="text-[10px] text-zinc-500 underline hover:text-zinc-700 shrink-0">Cambiar</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(selectedTemplate.fields).map(([key, def]) => (
                    <TemplateFieldInput key={key} fieldKey={key} def={def}
                      value={fields[key] ?? def.defaultValue ?? ""}
                      onChange={(v) => setFields((f) => ({ ...f, [key]: v }))} />
                  ))}
                </div>
                <div className="flex justify-between pt-2">
                  {!isEditing ? (
                    <Button variant="secondary" onClick={() => setStep(0)} className="h-10 px-5 text-zinc-700">
                      <ArrowLeft size={14} /> Atrás
                    </Button>
                  ) : <div />}
                  <Button onClick={() => setStep(2)} disabled={!step1Valid()} className="h-10 px-6">
                    Ver contrato <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {step === 2 && selectedTemplate && (
              <div className="space-y-5 max-w-3xl">
                <p className="text-sm text-zinc-400">
                  Revisá el contrato. Los datos del firmante y la autoridad se cargan al asignar.
                </p>
                <ContractDocument templateId={selectedTemplate.id} fields={fields} alumnos={[]} />
                <div className="flex justify-between pt-2">
                  <Button variant="secondary" onClick={() => setStep(1)} className="h-10 px-5 text-zinc-700">
                    <ArrowLeft size={14} /> Atrás
                  </Button>
                  <Button onClick={handleConfirm} disabled={creating}
                    className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white">
                    {creating
                      ? "Guardando..."
                      : isEditing
                        ? <><Check size={14} /> Guardar cambios</>
                        : <><Check size={14} /> Guardar borrador</>}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Toast message={toastMessage} type="success" visible={showToast} onClose={() => setShowToast(false)} duration={4000} />
      </div>
    );
  }

  // ── List view ──
  return (
    <>
      {viewContract && <ContractDetailModal contract={viewContract} onClose={() => setViewContract(null)} />}
      {sendThirdParty && (
        <SendThirdPartyModal contract={sendThirdParty} onClose={() => setSendThirdParty(null)}
          onSent={(id) => setContracts((prev) => prev.map((x) => x.id === id ? { ...x, status: "SENT", totalSigners: x.totalSigners + 1 } : x))} />
      )}
      {assignTarget && orgId && (
        <AssignUserModal
          contract={assignTarget}
          orgId={orgId}
          onClose={() => setAssignTarget(null)}
          onAssigned={(id) => {
            setContracts((prev) => prev.map((x) => x.id === id ? { ...x, status: "SENT", totalSigners: 1 } : x));
            setAssignTarget(null);
          }}
        />
      )}

      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">Documentos</h1>
          </div>
          <div className="flex items-center gap-1 border-b border-zinc-200">
            {([{ key: "contracts", label: "Contratos" }, { key: "convenios", label: "Convenios" }] as const).map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
                  activeTab === tab.key ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "convenios" && orgId && <AdminConveniosTab orgId={orgId} />}
        {activeTab === "convenios" && !orgId && <p className="text-sm text-zinc-400">Cargando organización...</p>}

        {activeTab === "contracts" && (
          <>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-zinc-500">
                {contracts.length} contratos · {CONTRACT_TEMPLATES.length} templates disponibles.
              </p>
              <Button onClick={() => { resetCreate(); setView("create"); }}
                disabled={hasActiveAuthority === false} className="shrink-0 h-10 px-4"
                title={hasActiveAuthority === false ? "Configurá una autoridad firmante activa primero" : undefined}>
                <Plus size={15} /> Nuevo contrato
              </Button>
            </div>

            {hasActiveAuthority === false && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                <p className="font-semibold">Sin autoridad firmante activa</p>
                <p className="mt-0.5 text-amber-700">
                  Configurá al menos una autoridad PERMANENTE activa en{" "}
                  <a href="/settings" className="underline hover:text-amber-900">Configuración → Autoridades</a>.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {CONTRACT_TEMPLATES.map((tpl) => {
                const ac = ACCENT_CLASSES[tpl.accent];
                return (
                  <button key={tpl.id} type="button"
                    onClick={() => { resetCreate(); pickTemplate(tpl); setView("create"); setStep(1); }}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110 ${ac.badge}`}>
                    {tpl.name}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 focus-within:border-zinc-300">
                <Files size={15} className="shrink-0 text-zinc-600" />
                <input className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-600"
                  placeholder="Buscar por título o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all","pending","signed","rejected"] as const).map((k) => (
                  <button key={k} onClick={() => setFilter(k)} type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      filter === k ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
                    {k === "all" ? "Todos" : k === "pending" ? "Pendientes" : k === "signed" ? "Firmados" : "Rechazados"}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              {loading ? (
                <div className="space-y-3 p-5">{Array(4).fill(null).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-50" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <Files size={32} className="text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">Sin contratos en este estado</p>
                  <button type="button" onClick={() => { resetCreate(); setView("create"); }}
                    className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-700">Crear el primero</button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filtered.map((c) => {
                    const { label, className } = statusMeta(c.status);
                    return (
                      <div key={c.id}
                        className="flex flex-col gap-2 px-5 py-4 hover:bg-zinc-50 transition sm:flex-row sm:items-center sm:justify-between group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-50">
                            <Files size={14} className="text-zinc-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 truncate">{c.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {c.ownerEmail} · v{c.versionNumber} · {new Date(c.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.status !== "DRAFT" && (
                            <span className="text-xs text-zinc-600 hidden sm:inline">{c.completedSigners}/{c.totalSigners} firmas</span>
                          )}
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>

                          {/* Botones para DRAFT */}
                          {c.status === "DRAFT" && c.templateId && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 transition">
                              <Pencil size={11} /> Editar
                            </button>
                          )}
                          {c.status === "DRAFT" && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setAssignTarget(c); }}
                              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-white hover:bg-zinc-700 transition">
                              <Send size={11} /> Asignar
                            </button>
                          )}

                          {c.status === "COMPLETED" && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setSendThirdParty(c); }}
                              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-100 transition">
                              <Send size={11} /> Enviar al tercero
                            </button>
                          )}
                          {c.finalPdfUrl && (
                            <a href={c.finalPdfUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition"
                              onClick={(e) => e.stopPropagation()}>
                              <Download size={11} /> PDF
                            </a>
                          )}
                          <button type="button" onClick={() => setViewContract(c)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 hover:bg-zinc-50 transition opacity-0 group-hover:opacity-100">
                            <Eye size={11} /> Ver
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Toast message={toastMessage} type="success" visible={showToast} onClose={() => setShowToast(false)} duration={4000} />
    </>
  );
}
