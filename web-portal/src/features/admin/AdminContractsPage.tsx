import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Files,
  LayoutTemplate,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
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
import {
  getContractTemplates,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
  extractVariables,
  AUTO_FILL_VARS,
  VAR_LABELS,
  type DbContractTemplate,
} from "../../shared/services/contractTemplates.service";
import type { Contract } from "../../shared/types/contract";
import type { AdminUserSummary } from "../../shared/types/user";
import { ContractDocument, ContractDetailModal } from "./components/ContractRenderer";
import { RichTextEditor } from "./components/RichTextEditor";
import { AdminConveniosTab } from "./AdminConveniosTab";

// ─── Status helpers ───────────────────────────────────────────────────────────

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
  const [authorities, setAuthorities]   = useState<OrgAuthority[]>([]);
  const [loadingAuth, setLoadingAuth]   = useState(true);
  const [selectedAuth, setSelectedAuth] = useState<OrgAuthority | null>(null);
  const [authSearch, setAuthSearch]     = useState("");

  const [users, setUsers]               = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [userSearch, setUserSearch]     = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    getOrgAuthorities(orgId)
      .then((all) => setAuthorities(all.filter((a) => a.status === "ACTIVE" && a.type === "PERMANENT")))
      .finally(() => setLoadingAuth(false));
    getAllUsers().then(setUsers).finally(() => setLoadingUsers(false));
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

  const searchBox = "flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 focus-within:border-zinc-400 transition";
  const inputBase = "w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-500 outline-none";

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
              <strong>{selectedUser?.fullName}</strong> verá el contrato pendiente en su panel.
              Firma por Escencial: <strong>{selectedAuth?.fullName}</strong>.
            </p>
            <Button onClick={onClose} className="h-10 px-6 mt-2">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 px-6 py-4 shrink-0">
              <h3 className="font-bold text-zinc-900">Asignar contrato</h3>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">"{contract.title}"</p>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {/* Autoridad */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest">1. Autoridad firmante por Escencial SAS</p>
                </div>
                <div className={searchBox}>
                  <Search size={14} className="text-zinc-400 shrink-0" />
                  <input className={inputBase} placeholder="Buscar autoridad..." value={authSearch} onChange={(e) => setAuthSearch(e.target.value)} />
                </div>
                {loadingAuth ? (
                  <div className="space-y-2">{Array(2).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-50" />)}</div>
                ) : filteredAuth.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-400">{authorities.length === 0 ? "Sin autoridades PERMANENTES activas" : "Sin resultados"}</p>
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
              {/* Destinatario */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Send size={13} className="text-zinc-500 shrink-0" />
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest">2. Destinatario (quien firma)</p>
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
            <div className="border-t border-zinc-100 px-6 py-4 flex gap-3 shrink-0">
              <Button variant="secondary" onClick={onClose} className="flex-1 h-10 text-zinc-700">Cancelar</Button>
              <Button onClick={handleAssign} disabled={!selectedAuth || !selectedUser || submitting} className="flex-1 h-10">
                {submitting ? "Asignando..." : <><Send size={14} /> Asignar y enviar</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Send Third Party Modal ───────────────────────────────────────────────────

function SendThirdPartyModal({
  contract, onClose, onSent,
}: { contract: Contract; onClose: () => void; onSent: (id: string) => void }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSend() {
    if (!name.trim() || !email.trim()) return;
    setSending(true);
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

  const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-5">
        {done ? (
          <div className="text-center py-4 space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
              <Check size={24} className="text-emerald-600" />
            </div>
            <p className="font-bold text-zinc-900">Enviado a {name}</p>
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
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del firmante" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className={inputCls} />
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

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: DbContractTemplate;
  onUse:    () => void;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const vars      = extractVariables(template.contentHtml);
  const adminVars = vars.filter((v) => !AUTO_FILL_VARS.has(v));
  const autoVars  = vars.filter((v) => AUTO_FILL_VARS.has(v));

  return (
    <div className="group rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col gap-3 hover:border-zinc-300 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-100">
            <FileText size={16} className="text-zinc-500" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 text-sm">{template.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{new Date(template.createdAt).toLocaleDateString("es-AR")}</p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button type="button" onClick={onEdit}
            className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
            <Pencil size={12} />
          </button>
          <button type="button" onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {template.description && (
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{template.description}</p>
      )}

      {vars.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {adminVars.map((v) => (
            <span key={v} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              {"{{"}{v}{"}}"}
            </span>
          ))}
          {autoVars.map((v) => (
            <span key={v} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
              {"{{"}{v}{"}}"}
            </span>
          ))}
        </div>
      )}

      <Button onClick={onUse} className="mt-auto h-9 w-full text-xs">
        <ChevronRight size={13} /> Usar esta plantilla
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageView = "list" | "templates" | "editor" | "filling";

export function AdminContractsPage() {
  const [activeTab, setActiveTab] = useState<"contracts" | "convenios">("contracts");
  const [orgId, setOrgId]         = useState<string | null>(null);
  const [hasActiveAuthority, setHasActiveAuthority] = useState<boolean | null>(null);

  // Contract list state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "pending" | "signed" | "rejected">("all");
  const [search, setSearch]       = useState("");
  const [viewContract, setViewContract]     = useState<Contract | null>(null);
  const [sendThirdParty, setSendThirdParty] = useState<Contract | null>(null);
  const [assignTarget, setAssignTarget]     = useState<Contract | null>(null);

  // DB Template state
  const [dbTemplates, setDbTemplates]           = useState<DbContractTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Page view
  const [view, setView] = useState<PageView>("list");

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<DbContractTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  // Filling state
  const [activeTemplate, setActiveTemplate]         = useState<DbContractTemplate | null>(null);
  const [varValues, setVarValues]                   = useState<Record<string, string>>({});
  const [showPreview, setShowPreview]               = useState(false);
  const [editingContractId, setEditingContractId]   = useState<string | null>(null);
  const [creatingContract, setCreatingContract]     = useState(false);
  const [contractDone, setContractDone]             = useState(false);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "" });
  const showToast = (message: string) => setToast({ visible: true, message });

  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Init ──
  useEffect(() => {
    getAllContracts().then((c) => { setContracts(c); setLoading(false); });
    getMyOrganization().then((org) => {
      if (!org) { setHasActiveAuthority(false); return; }
      setOrgId(org.id);
      return getOrgAuthorities(org.id).then((auths) => {
        setHasActiveAuthority(auths.some((a) => a.status === "ACTIVE"));
      });
    }).catch(() => setHasActiveAuthority(null));
  }, []);

  useEffect(() => {
    if (activeTab !== "contracts" || !orgId) return;
    setLoadingTemplates(true);
    getContractTemplates(orgId).then(setDbTemplates).finally(() => setLoadingTemplates(false));
  }, [activeTab, orgId]);

  // ── Contract list filter ──
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

  // ── Template editor ──

  function openNewTemplate() {
    setEditingTemplate(null);
    setTplName(""); setTplDesc(""); setTplHtml("");
    setView("editor");
  }

  function openEditTemplate(tpl: DbContractTemplate) {
    setEditingTemplate(tpl);
    setTplName(tpl.name); setTplDesc(tpl.description); setTplHtml(tpl.contentHtml);
    setView("editor");
  }

  async function handleSaveTemplate() {
    const htmlContent = tplHtml.replace(/<[^>]+>/g, "").trim();
    if (!tplName.trim() || !htmlContent) return;
    setSavingTpl(true);
    try {
      if (editingTemplate) {
        await updateContractTemplate(editingTemplate.id, { name: tplName, description: tplDesc, contentHtml: tplHtml });
        setDbTemplates((prev) => prev.map((t) => t.id === editingTemplate.id
          ? { ...t, name: tplName, description: tplDesc, contentHtml: tplHtml }
          : t));
        showToast("Plantilla actualizada.");
      } else if (orgId) {
        const created = await createContractTemplate({ orgId, name: tplName, description: tplDesc, contentHtml: tplHtml });
        setDbTemplates((prev) => [created, ...prev]);
        showToast("Plantilla creada.");
      }
      setView("templates");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error guardando plantilla");
    } finally {
      setSavingTpl(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm("¿Eliminar esta plantilla? Los contratos ya creados no se ven afectados.")) return;
    await deleteContractTemplate(id);
    setDbTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast("Plantilla eliminada.");
  }

  // ── Contract creation from template ──

  function useTemplate(tpl: DbContractTemplate) {
    setActiveTemplate(tpl);
    const vars = extractVariables(tpl.contentHtml);
    const initial: Record<string, string> = {};
    vars.filter((v) => !AUTO_FILL_VARS.has(v)).forEach((v) => { initial[v] = ""; });
    setVarValues(initial);
    setShowPreview(false);
    setContractDone(false);
    setEditingContractId(null);
    setView("filling");
  }

  function editContractFilling(contract: Contract) {
    const dbTplId = contract.templateFields?._dbTemplateId;
    const tpl = dbTplId ? dbTemplates.find((t) => t.id === dbTplId) : null;
    if (!tpl) return;
    setActiveTemplate(tpl);
    const vars = extractVariables(tpl.contentHtml);
    const initial: Record<string, string> = {};
    vars.filter((v) => !AUTO_FILL_VARS.has(v)).forEach((v) => {
      initial[v] = contract.templateFields?.[v] ?? "";
    });
    setVarValues(initial);
    setShowPreview(false);
    setContractDone(false);
    setEditingContractId(contract.id);
    setView("filling");
  }

  const fillingVars = useMemo(() => activeTemplate ? extractVariables(activeTemplate.contentHtml) : [], [activeTemplate]);
  const adminVars   = fillingVars.filter((v) => !AUTO_FILL_VARS.has(v));
  const autoVars    = fillingVars.filter((v) => AUTO_FILL_VARS.has(v));
  const allAdminFilled = adminVars.every((v) => !!varValues[v]?.trim());

  const previewFields = useMemo(() => {
    if (!activeTemplate) return {};
    return {
      _templateContent: activeTemplate.contentHtml,
      _legalTitle:      activeTemplate.name,
      _dbTemplateId:    activeTemplate.id,
      ...varValues,
    };
  }, [activeTemplate, varValues]);

  async function handleCreateContract() {
    if (!activeTemplate) return;
    setCreatingContract(true);
    try {
      const templateFields: Record<string, string> = {
        _templateContent: activeTemplate.contentHtml,
        _legalTitle:      activeTemplate.name,
        _dbTemplateId:    activeTemplate.id,
        ...varValues,
      };
      if (editingContractId) {
        await updateContractFields(editingContractId, templateFields);
        setContracts((prev) => prev.map((c) => c.id === editingContractId ? { ...c, templateFields } : c));
        showToast("Cambios guardados.");
      } else {
        const newContract = await createContract({
          title:          activeTemplate.name,
          description:    activeTemplate.description || activeTemplate.name,
          templateId:     "custom",
          templateFields,
          signers:        [],
        });
        setContracts((c) => [newContract, ...c]);
        showToast("Contrato creado como borrador.");
      }
      setContractDone(true);
      redirectTimer.current = setTimeout(() => {
        setView("list");
        setContractDone(false);
        setActiveTemplate(null);
        setEditingContractId(null);
      }, 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error");
    } finally {
      setCreatingContract(false);
    }
  }

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  // ─── Editor view ───────────────────────────────────────────────────────────

  if (view === "editor") {
    const isValid = !!(tplName.trim() && tplHtml.replace(/<[^>]+>/g, "").trim());
    return (
      <div className="min-h-screen space-y-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setView("templates")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Plantillas</p>
            <h2 className="font-bold text-zinc-900">{editingTemplate ? "Editar plantilla" : "Nueva plantilla"}</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Nombre de la plantilla *</label>
            <input value={tplName} onChange={(e) => setTplName(e.target.value)}
              placeholder="Ej: Contrato de prestación de servicios"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Descripción (opcional)</label>
            <input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)}
              placeholder="Descripción breve"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
          </div>
        </div>

        <RichTextEditor
          value={tplHtml}
          onChange={setTplHtml}
          placeholder="Redactá el contrato aquí. Usá las variables del panel derecho para insertar datos dinámicos..."
        />

        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setView("templates")} className="h-10 px-5 text-zinc-700">
            <ArrowLeft size={14} /> Cancelar
          </Button>
          <Button onClick={handleSaveTemplate} disabled={!isValid || savingTpl} className="h-10 px-6">
            {savingTpl ? "Guardando..." : <><Check size={14} /> {editingTemplate ? "Guardar cambios" : "Crear plantilla"}</>}
          </Button>
        </div>

        <Toast message={toast.message} type="success" visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
      </div>
    );
  }

  // ─── Templates view ────────────────────────────────────────────────────────

  if (view === "templates") {
    return (
      <div className="min-h-screen space-y-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setView("list")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Contratos</p>
            <h2 className="font-bold text-zinc-900">Plantillas de contratos</h2>
          </div>
          <Button onClick={openNewTemplate} className="ml-auto h-10 px-4 shrink-0">
            <Plus size={14} /> Nueva plantilla
          </Button>
        </div>

        {loadingTemplates ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(3).fill(null).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-100" />)}
          </div>
        ) : dbTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100">
              <LayoutTemplate size={28} className="text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-700">Sin plantillas</p>
              <p className="text-sm text-zinc-400 mt-1">Creá tu primera plantilla de contrato con el editor.</p>
            </div>
            <Button onClick={openNewTemplate} className="h-10 px-5">
              <Plus size={14} /> Crear primera plantilla
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dbTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onUse={() => useTemplate(tpl)}
                onEdit={() => openEditTemplate(tpl)}
                onDelete={() => handleDeleteTemplate(tpl.id)}
              />
            ))}
          </div>
        )}

        <Toast message={toast.message} type="success" visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
      </div>
    );
  }

  // ─── Filling view ──────────────────────────────────────────────────────────

  if (view === "filling" && activeTemplate) {
    return (
      <div className="min-h-screen space-y-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => { setView("templates"); setShowPreview(false); }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Contratos · {editingContractId ? "Editar" : "Nuevo"}</p>
            <h2 className="font-bold text-zinc-900">{activeTemplate.name}</h2>
          </div>
        </div>

        {contractDone ? (
          <div className="flex flex-col items-center py-20 text-center max-w-sm mx-auto gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
              <Check size={36} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">{editingContractId ? "Cambios guardados" : "Contrato creado"}</h3>
              <p className="text-sm text-zinc-500 mt-2">
                {editingContractId
                  ? "Los campos del contrato fueron actualizados."
                  : "Borrador guardado. Asignalo a un usuario desde la lista."}
              </p>
            </div>
            <Button onClick={() => { setView("list"); setContractDone(false); }} className="h-10 px-5">
              Ver contratos
            </Button>
          </div>
        ) : showPreview ? (
          <div className="space-y-5 max-w-3xl">
            <p className="text-sm text-zinc-400">
              Las variables en verde se completan al asignar. Los datos del firmante y la autoridad se cargan en ese paso.
            </p>
            <ContractDocument templateId="custom" fields={previewFields} alumnos={[]} />
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setShowPreview(false)} className="h-10 px-5 text-zinc-700">
                <ArrowLeft size={14} /> Volver
              </Button>
              <Button onClick={handleCreateContract} disabled={creatingContract} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white">
                {creatingContract ? "Guardando..." : <><Check size={14} /> {editingContractId ? "Guardar cambios" : "Guardar borrador"}</>}
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            {adminVars.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-zinc-700">Completá los datos del contrato:</p>
                <div className="grid grid-cols-2 gap-4">
                  {adminVars.map((v) => {
                    const isLong = v.includes("objeto") || v.includes("descripcion");
                    const isDate = v.includes("fecha");
                    const isNum  = v.includes("monto") || v.includes("cuotas");
                    return (
                      <div key={v} className={isLong ? "col-span-2" : ""}>
                        <label className="mb-1 block text-xs font-semibold text-zinc-400">
                          {VAR_LABELS[v] ?? v.replace(/_/g, " ")}
                        </label>
                        {isLong ? (
                          <textarea value={varValues[v] ?? ""} rows={3} placeholder={`{{${v}}}`}
                            onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition resize-none" />
                        ) : (
                          <input
                            type={isDate ? "date" : isNum ? "number" : "text"}
                            value={varValues[v] ?? ""} placeholder={`{{${v}}}`}
                            onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-500">
                Esta plantilla no tiene variables para completar.
              </div>
            )}

            {autoVars.length > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Variables automáticas</p>
                <p className="text-xs text-emerald-600">Se completan al asignar a un usuario:</p>
                <div className="flex flex-wrap gap-1.5">
                  {autoVars.map((v) => (
                    <span key={v} className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                      {"{{"}{v}{"}}"} — {VAR_LABELS[v] ?? v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setView("templates")} className="h-10 px-5 text-zinc-700">
                <ArrowLeft size={14} /> Cambiar plantilla
              </Button>
              <Button onClick={() => setShowPreview(true)} disabled={!allAdminFilled && adminVars.length > 0} className="h-10 px-6">
                Ver contrato <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        <Toast message={toast.message} type="success" visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
      </div>
    );
  }

  // ─── List view ─────────────────────────────────────────────────────────────

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
              <p className="text-sm text-zinc-500">{contracts.length} contratos</p>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" onClick={() => setView("templates")} className="h-10 px-4 text-zinc-700">
                  <LayoutTemplate size={14} /> Plantillas
                  {dbTemplates.length > 0 && (
                    <span className="ml-1 rounded-full bg-zinc-200 text-zinc-700 text-[10px] px-1.5 py-0.5 font-bold">{dbTemplates.length}</span>
                  )}
                </Button>
                <Button onClick={() => setView("templates")} disabled={hasActiveAuthority === false} className="h-10 px-4"
                  title={hasActiveAuthority === false ? "Configurá una autoridad firmante primero" : undefined}>
                  <Plus size={15} /> Nuevo contrato
                </Button>
              </div>
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
                  <button type="button" onClick={() => setView("templates")}
                    className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-700">Crear el primero</button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filtered.map((c) => {
                    const { label, className } = statusMeta(c.status);
                    const isCustom = !!(c.templateFields?._dbTemplateId || c.templateFields?._templateContent);
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

                          {c.status === "DRAFT" && isCustom && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); editContractFilling(c); }}
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

      <Toast message={toast.message} type="success" visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
    </>
  );
}
