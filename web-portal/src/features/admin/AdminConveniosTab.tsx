import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../shared/components/ui/Button";
import { Toast } from "../../shared/components/ui/Toast";
import { getAllUsers } from "../../shared/services/admin.service";
import { getOrgAuthorities, type OrgAuthority } from "../../shared/services/authorities.service";
import { sendContractFromTemplate } from "../../shared/services/contracts.service";
import {
  getConvenioTemplates,
  createConvenioTemplate,
  deleteConvenioTemplate,
  activateConvenioTemplate,
  type ConvenioTemplate,
} from "../../shared/services/convenioTemplates.service";
import {
  getContractTemplates,
  extractVariables,
  AUTO_FILL_VARS,
  ORG_VARS,
  SYSTEM_VARS,
  VAR_LABELS,
  type DbContractTemplate,
} from "../../shared/services/contractTemplates.service";
import { ContractDocument } from "./components/ContractRenderer";
import type { AdminUserSummary } from "../../shared/types/user";
import type { Contract } from "../../shared/types/contract";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button type="button" onClick={copy}
      className="grid h-5 w-5 shrink-0 place-items-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition">
      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
    </button>
  );
}

// ─── Select Model Modal ───────────────────────────────────────────────────────

function SelectModelModal({
  contractTemplates,
  orgId,
  onClose,
  onCreate,
}: {
  contractTemplates: DbContractTemplate[];
  orgId: string;
  onClose: () => void;
  onCreate: (tpl: ConvenioTemplate) => void;
}) {
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<DbContractTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState("");

  const filtered = useMemo(() => {
    if (!search) return contractTemplates;
    const q = search.toLowerCase();
    return contractTemplates.filter((t) => t.name.toLowerCase().includes(q));
  }, [contractTemplates, search]);

  async function handleCreate() {
    if (!selected) return;
    setCreating(true);
    setError("");
    try {
      const created = await createConvenioTemplate({
        orgId,
        name:        selected.name,
        description: selected.description,
        contentHtml: selected.contentHtml,
      });
      onCreate(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear convenio");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-5">
        <div className="border-b border-zinc-100 pb-4">
          <h3 className="font-bold text-zinc-900">Crear convenio desde modelo</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Seleccioná un modelo existente. Su contenido se usará como base del convenio y requiere firma de autoridad provisional.
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 focus-within:border-zinc-400 transition">
          <Search size={14} className="text-zinc-400 shrink-0" />
          <input className="w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-500 outline-none"
            placeholder="Buscar modelo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400">
              {contractTemplates.length === 0 ? "Sin modelos disponibles. Creá uno desde el tab Modelos." : "Sin resultados"}
            </p>
          ) : filtered.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelected(t)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 ${selected?.id === t.id ? "bg-zinc-100" : ""}`}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-100">
                <FileText size={14} className="text-zinc-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 truncate">{t.name}</p>
                {t.description && <p className="text-xs text-zinc-500 truncate">{t.description}</p>}
              </div>
              {selected?.id === t.id && <Check size={13} className="text-emerald-600 shrink-0" />}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 h-10 text-zinc-700">Cancelar</Button>
          <Button onClick={handleCreate} disabled={!selected || creating} className="flex-1 h-10">
            {creating ? "Creando..." : <><Check size={14} /> Crear convenio</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Activation Modal ─────────────────────────────────────────────────────────

function ActivateModal({
  template,
  onClose,
  onActivated,
}: {
  template: ConvenioTemplate;
  onClose: () => void;
  onActivated: () => void;
}) {
  const [users, setUsers]           = useState<AdminUserSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<AdminUserSummary | null>(null);
  const [activating, setActivating] = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    getAllUsers(template.organizationId).then(setUsers).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  async function handleActivate() {
    if (!selected) return;
    setActivating(true);
    setError("");
    try {
      await activateConvenioTemplate(template.id, {
        name:  selected.fullName,
        email: selected.email,
        cuil:  selected.cuilCuit,
      });
      setDone(true);
      onActivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al activar");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-5">
        {done ? (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 border border-amber-200">
              <Clock size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-zinc-900">Convenio enviado a {selected?.fullName}</p>
              <p className="text-xs text-zinc-500 mt-1">
                Una vez que revise y firme el convenio, la plantilla quedará confirmada y podrás enviarla a usuarios.
              </p>
            </div>
            <Button onClick={onClose} className="h-10 px-6">Entendido</Button>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 pb-4">
              <h3 className="font-bold text-zinc-900">Asignar autoridad provisional</h3>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                Plantilla: <strong>{template.name}</strong>
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Seleccioná el usuario que leerá y firmará este convenio. Una vez que firme, la plantilla quedará confirmada.
              </p>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 focus-within:border-zinc-400 transition">
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input className="w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-500 outline-none"
                placeholder="Buscar usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loading ? (
              <div className="space-y-2">{Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>
            ) : (
              <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-56 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-400">Sin resultados</p>
                ) : filtered.map((u) => (
                  <button key={u.id} type="button" onClick={() => setSelected(u)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50 ${selected?.id === u.id ? "bg-zinc-100" : ""}`}>
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-white">
                      {u.fullName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{u.fullName}</p>
                      <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                    </div>
                    {selected?.id === u.id && <Check size={13} className="text-emerald-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={onClose} className="flex-1 h-10 text-zinc-700">Cancelar</Button>
              <Button onClick={handleActivate} disabled={!selected || activating} className="flex-1 h-10">
                {activating ? "Enviando..." : <><Send size={14} /> Enviar para aprobar</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Convenio Template Row ────────────────────────────────────────────────────

function ConvenioTemplateCard({
  template,
  onActivate,
  onSend,
  onDelete,
}: {
  template:   ConvenioTemplate;
  onActivate: () => void;
  onSend:     () => void;
  onDelete:   () => void;
}) {
  const vars       = extractVariables(template.contentHtml);
  const autoVars   = vars.filter((v) =>  AUTO_FILL_VARS.has(v));
  const orgVars    = vars.filter((v) =>  ORG_VARS.has(v) && !AUTO_FILL_VARS.has(v));
  const systemVars = vars.filter((v) =>  SYSTEM_VARS.has(v));
  const customVars = vars.filter((v) => !AUTO_FILL_VARS.has(v) && !ORG_VARS.has(v) && !SYSTEM_VARS.has(v));
  const manualVarsCount = systemVars.length + customVars.length;
  const confirmed  = template.status === "CONFIRMED";
  const [showVars, setShowVars] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  return (
    <div className="border-b border-zinc-100 last:border-0">
      <div className="flex items-center gap-3 px-1 py-3 hover:bg-zinc-50/60 rounded-xl transition">
        <FileText size={14} className="shrink-0 text-zinc-400" />

        {/* Nombre + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <p className="text-sm font-semibold text-zinc-900 truncate">{template.name}</p>
            {/* Estado badge */}
            {confirmed ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                <Check size={8} /> Confirmado
              </span>
            ) : template.approvalDocumentId ? (
              <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 shrink-0">
                <Clock size={8} /> Esperando firma de {template.provisionalSignerName}
              </span>
            ) : (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 shrink-0">
                Sin confirmar
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{new Date(template.createdAt).toLocaleDateString("es-AR")}</span>
            {vars.length > 0 && (
              <>
                <span className="text-zinc-300">·</span>
                <button type="button" onClick={() => setShowVars((v) => !v)}
                  className="hover:text-zinc-600 transition hover:underline underline-offset-2">
                  {manualVarsCount > 0 && <>{manualVarsCount} variable{manualVarsCount !== 1 ? "s" : ""}</>}
                  {manualVarsCount > 0 && (orgVars.length > 0 || autoVars.length > 0) && <span className="mx-0.5 text-zinc-300">·</span>}
                  {orgVars.length > 0 && <span className="text-blue-500">{orgVars.length} empresa</span>}
                  {orgVars.length > 0 && autoVars.length > 0 && <span className="mx-0.5 text-zinc-300">·</span>}
                  {autoVars.length > 0 && <span className="text-emerald-500">{autoVars.length} auto</span>}
                </button>
              </>
            )}
            {template.description && (
              <>
                <span className="text-zinc-300">·</span>
                <button type="button" onClick={() => setShowDesc((v) => !v)}
                  className="hover:text-zinc-600 transition hover:underline underline-offset-2">
                  {showDesc ? "ocultar" : "descripción"}
                </button>
              </>
            )}
          </p>
          {showDesc && template.description && (
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{template.description}</p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onDelete} title="Eliminar convenio"
            className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-red-50 hover:text-red-500 hover:border hover:border-red-200 transition">
            <Trash2 size={12} />
          </button>
          {confirmed ? (
            <button type="button" onClick={onSend}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 h-8 text-[11px] font-semibold transition ml-1"
              style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
              <Send size={11} /> Enviar
            </button>
          ) : !template.approvalDocumentId ? (
            <button type="button" onClick={onActivate}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 h-8 text-[11px] font-semibold transition ml-1"
              style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
              <ShieldCheck size={11} /> Activar
            </button>
          ) : (
            <button type="button" disabled
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 h-8 text-[11px] font-semibold border border-amber-100 bg-amber-50 text-amber-500 cursor-not-allowed ml-1">
              <Clock size={11} /> Esperando firma
            </button>
          )}
        </div>
      </div>

      {/* Variables expandibles */}
      {showVars && vars.length > 0 && (
        <div className="px-6 pb-3 space-y-1.5">
          {orgVars.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-zinc-400 mr-1 self-center">Empresa:</span>
              {orgVars.map((v) => (
                <span key={v} title={VAR_LABELS[v]} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-medium text-blue-700">
                  {"{{"}{v}{"}}"}
                </span>
              ))}
            </div>
          )}
          {autoVars.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-zinc-400 mr-1 self-center">Firmante:</span>
              {autoVars.map((v) => (
                <span key={v} title={VAR_LABELS[v]} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-700">
                  {"{{"}{v}{"}}"}
                </span>
              ))}
            </div>
          )}
          {(systemVars.length > 0 || customVars.length > 0) && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-zinc-400 mr-1 self-center">A completar:</span>
              {systemVars.map((v) => (
                <span key={v} title={VAR_LABELS[v]} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-mono font-medium text-sky-700">
                  {"{{"}{v}{"}}"}
                </span>
              ))}
              {customVars.map((v) => (
                <span key={v} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-700">
                  {"{{"}{v}{"}}"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sending Flow ─────────────────────────────────────────────────────────────

function ConvenioSendingFlow({
  template,
  orgId,
  onDone,
  onBack,
}: {
  template: ConvenioTemplate;
  orgId:    string;
  onDone:   (contract: Contract) => void;
  onBack:   () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [authorities, setAuthorities]   = useState<OrgAuthority[]>([]);
  const [loadingAuth, setLoadingAuth]   = useState(true);
  const [selectedAuth, setSelectedAuth] = useState<OrgAuthority | null>(null);
  const [authSearch, setAuthSearch]     = useState("");

  const [users, setUsers]               = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [userSearch, setUserSearch]     = useState("");

  const allVars   = useMemo(() => extractVariables(template.contentHtml), [template]);
  const adminVars = allVars.filter((v) => !AUTO_FILL_VARS.has(v));
  const autoVars  = allVars.filter((v) =>  AUTO_FILL_VARS.has(v));

  const [varValues, setVarValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    adminVars.forEach((v) => { init[v] = ""; });
    return init;
  });

  useEffect(() => {
    if (!selectedUser) return;
    setVarValues((prev) => ({
      ...prev,
      nombre_usuario:    selectedUser.fullName,
      email_usuario:     selectedUser.email,
      dni_usuario:       selectedUser.documentNumber  ?? "",
      cuil_usuario:      selectedUser.cuilCuit        ?? "",
      domicilio_usuario: selectedUser.address         ?? "",
    }));
  }, [selectedUser]);

  const [sending, setSending] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const [sentContract, setSentContract] = useState<Contract | null>(null);

  useEffect(() => {
    getOrgAuthorities(orgId)
      .then((all) => setAuthorities(all.filter((a) => a.status === "ACTIVE" && a.type === "PERMANENT")))
      .finally(() => setLoadingAuth(false));
    getAllUsers(orgId).then(setUsers).finally(() => setLoadingUsers(false));
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

  const allAdminFilled = adminVars.every((v) => !!varValues[v]?.trim());

  const previewFields = useMemo(() => ({
    _templateContent: template.contentHtml,
    _legalTitle:      template.name,
    _dbTemplateId:    template.id,
    ...varValues,
  }), [template, varValues]);

  async function handleSend() {
    if (!selectedAuth || !selectedUser) return;
    setSending(true);
    setError("");
    try {
      const templateFields: Record<string, string> = {
        _templateContent: template.contentHtml,
        _legalTitle:      template.name,
        _dbTemplateId:    template.id,
        ...varValues,
      };
      const contract = await sendContractFromTemplate({
        title:          template.name,
        description:    template.description || template.name,
        templateFields,
        user: {
          email:     selectedUser.email,
          name:      selectedUser.fullName,
          dni:       selectedUser.documentNumber,
          cuil:      selectedUser.cuilCuit,
          domicilio: selectedUser.address,
        },
        authority: {
          fullName:     selectedAuth.fullName,
          cuil:         selectedAuth.cuil ?? selectedAuth.cuit,
          email:        selectedAuth.email,
          signatureUrl: selectedAuth.signatureUrl,
        },
      });
      setSentContract(contract);
      setDone(true);
      onDone(contract);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  const searchBox = "flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 focus-within:border-zinc-400 transition";
  const inputBase = "w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-500 outline-none";

  if (done && sentContract) {
    return (
      <div className="flex flex-col items-center py-20 text-center max-w-sm mx-auto gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
          <Check size={36} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900">Convenio enviado</h3>
          <p className="text-sm text-zinc-500 mt-2">
            <strong>{selectedUser?.fullName}</strong> verá el convenio pendiente en su panel.
          </p>
        </div>
        <Button onClick={onBack} className="h-10 px-6 mt-2">Volver a convenios</Button>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-zinc-400">Elegí la autoridad permanente de Escencial SAS y el usuario que recibirá el convenio.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest">Autoridad firmante (Escencial SAS)</p>
            </div>
            <div className={searchBox}>
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input className={inputBase} placeholder="Buscar autoridad..." value={authSearch} onChange={(e) => setAuthSearch(e.target.value)} />
            </div>
            {loadingAuth ? (
              <div className="space-y-2">{Array(2).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>
            ) : filteredAuth.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">{authorities.length === 0 ? "Sin autoridades PERMANENTES activas" : "Sin resultados"}</p>
            ) : (
              <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-52 overflow-y-auto">
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
                <Check size={12} className="text-emerald-600 shrink-0" />
                <p className="text-xs font-semibold text-emerald-800 truncate">{selectedAuth.fullName}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User size={13} className="text-zinc-500 shrink-0" />
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-widest">Destinatario (quien firma)</p>
            </div>
            <div className={searchBox}>
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input className={inputBase} placeholder="Buscar usuario..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            {loadingUsers ? (
              <div className="space-y-2">{Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">Sin usuarios</p>
            ) : (
              <div className="rounded-xl border border-zinc-100 divide-y divide-zinc-50 max-h-52 overflow-y-auto">
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
                <Check size={12} className="text-zinc-600 shrink-0" />
                <p className="text-xs font-semibold text-zinc-700 truncate">{selectedUser.fullName}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="secondary" onClick={onBack} className="h-10 px-5 text-zinc-700">
            <ArrowLeft size={14} /> Volver
          </Button>
          <Button onClick={() => setStep(1)} disabled={!selectedAuth || !selectedUser} className="h-10 px-6">
            Completar variables <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Variables del convenio</p>
            {autoVars.length > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Auto-completadas del usuario</p>
                {autoVars.map((v) => (
                  <div key={v} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-emerald-700">{"{{"}{v}{"}}"}</span>
                    <span className="text-[11px] text-emerald-800 font-semibold truncate max-w-[140px]">{varValues[v] || "—"}</span>
                  </div>
                ))}
              </div>
            )}
            {adminVars.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Completar manualmente</p>
                {adminVars.map((v) => {
                  const isLong = v.includes("objeto") || v.includes("descripcion");
                  const isDate = v.includes("fecha");
                  const isNum  = v.includes("monto") || v.includes("cuotas");
                  return (
                    <div key={v}>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">
                        {VAR_LABELS[v] ?? v.replace(/_/g, " ")}
                      </label>
                      {isLong ? (
                        <textarea value={varValues[v] ?? ""} rows={2} placeholder={`{{${v}}}`}
                          onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition resize-none" />
                      ) : (
                        <input type={isDate ? "date" : isNum ? "number" : "text"}
                          value={varValues[v] ?? ""} placeholder={`{{${v}}}`}
                          onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-400">
                No hay variables manuales — todo se auto-completa.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Datos del usuario</p>
            {selectedUser && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-800 text-sm font-bold text-white">
                    {selectedUser.fullName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">{selectedUser.fullName}</p>
                    <p className="text-xs text-zinc-500">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  {[
                    { label: "Nombre completo", value: selectedUser.fullName },
                    { label: "Email",           value: selectedUser.email },
                    { label: "DNI",             value: selectedUser.documentNumber ?? "—" },
                    { label: "CUIL/CUIT",       value: selectedUser.cuilCuit ?? "—" },
                    { label: "Domicilio",       value: selectedUser.address ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-500 shrink-0">{label}</span>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-medium text-zinc-800 truncate">{value}</span>
                        {value !== "—" && <CopyBtn value={value} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setStep(0)} className="h-10 px-5 text-zinc-700">
            <ArrowLeft size={14} /> Atrás
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={!allAdminFilled && adminVars.length > 0} className="h-10 px-5 text-zinc-700">
              <Eye size={14} /> Vista previa
            </Button>
            <Button onClick={handleSend} disabled={(!allAdminFilled && adminVars.length > 0) || sending} className="h-10 px-6">
              {sending ? "Enviando..." : <><Send size={14} /> Enviar convenio</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Vista previa. Las variables en verde son del usuario.</p>
        <Button variant="secondary" onClick={() => setStep(1)} className="h-8 px-3 text-xs text-zinc-700">
          Editar
        </Button>
      </div>
      <ContractDocument templateId="custom" fields={previewFields} alumnos={[]} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setStep(1)} className="h-10 px-5 text-zinc-700">
          <ArrowLeft size={14} /> Atrás
        </Button>
        <Button onClick={handleSend} disabled={sending} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white">
          {sending ? "Enviando..." : <><Send size={14} /> Enviar convenio</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

type TabView = "list" | "sending";

export function AdminConveniosTab({ orgId }: { orgId: string }) {
  const [templates, setTemplates]             = useState<ConvenioTemplate[]>([]);
  const [contractTpls, setContractTpls]       = useState<DbContractTemplate[]>([]);
  const [loadingTpl, setLoadingTpl]           = useState(true);
  const [view, setView]                       = useState<TabView>("list");
  const [sendingTemplate, setSendingTemplate] = useState<ConvenioTemplate | null>(null);
  const [activateTarget, setActivateTarget]   = useState<ConvenioTemplate | null>(null);
  const [showSelectModel, setShowSelectModel] = useState(false);

  const [toast, setToast] = useState({ visible: false, message: "" });
  const showToast = (message: string) => setToast({ visible: true, message });

  const loadTemplates = useCallback(() => {
    setLoadingTpl(true);
    getConvenioTemplates(orgId).then(setTemplates).finally(() => setLoadingTpl(false));
  }, [orgId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => {
    getContractTemplates(orgId).then(setContractTpls).catch(() => {});
  }, [orgId]);

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar este convenio?")) return;
    await deleteConvenioTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast("Convenio eliminado.");
  }

  // ── Sending view ─────────────────────────────────────────────────────────────
  if (view === "sending" && sendingTemplate) {
    return (
      <div className="min-h-screen space-y-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setView("list")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Convenios · Enviar</p>
            <h2 className="font-bold text-zinc-900">{sendingTemplate.name}</h2>
          </div>
        </div>

        <ConvenioSendingFlow
          template={sendingTemplate}
          orgId={orgId}
          onDone={() => { showToast("Convenio enviado."); }}
          onBack={() => setView("list")}
        />

        <Toast message={toast.message} type="success" visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const confirmed   = templates.filter((t) => t.status === "CONFIRMED");
  const unconfirmed = templates.filter((t) => t.status === "UNCONFIRMED");

  return (
    <>
      {activateTarget && (
        <ActivateModal
          template={activateTarget}
          onClose={() => setActivateTarget(null)}
          onActivated={() => {
            setActivateTarget(null);
            loadTemplates();
            showToast("Enviado a la autoridad provisional para su firma.");
          }}
        />
      )}

      {showSelectModel && (
        <SelectModelModal
          contractTemplates={contractTpls}
          orgId={orgId}
          onClose={() => setShowSelectModel(false)}
          onCreate={(created) => {
            setTemplates((prev) => [created, ...prev]);
            setShowSelectModel(false);
            showToast("Convenio creado. Activalo asignando una autoridad provisional.");
          }}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">{templates.length} convenio{templates.length !== 1 ? "s" : ""}</p>
            <p className="text-xs text-zinc-400 mt-0.5">El contenido se define desde el tab <strong>Modelos</strong></p>
          </div>
          <Button onClick={() => setShowSelectModel(true)} className="h-10 px-4 shrink-0">
            <Plus size={14} /> Crear desde modelo
          </Button>
        </div>

        {loadingTpl ? (
          <div className="rounded-2xl border border-zinc-100 bg-white px-2">
            {Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse my-1 rounded-xl bg-zinc-100" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100">
              <FileText size={28} className="text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-700">Sin convenios</p>
              <p className="text-sm text-zinc-400 mt-1 max-w-xs">
                Creá un convenio seleccionando un modelo existente. Luego se activa con una autoridad provisional antes de enviarlo a usuarios.
              </p>
            </div>
            <Button onClick={() => setShowSelectModel(true)} className="h-10 px-5">
              <Plus size={14} /> Crear desde modelo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {confirmed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Confirmados — listos para enviar</p>
                <div className="rounded-2xl border border-zinc-100 bg-white px-2">
                  {confirmed.map((tpl) => (
                    <ConvenioTemplateCard
                      key={tpl.id}
                      template={tpl}
                      onActivate={() => setActivateTarget(tpl)}
                      onSend={() => { setSendingTemplate(tpl); setView("sending"); }}
                      onDelete={() => handleDelete(tpl.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {unconfirmed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Sin confirmar — requieren firma de autoridad provisional</p>
                <div className="rounded-2xl border border-zinc-100 bg-white px-2">
                  {unconfirmed.map((tpl) => (
                    <ConvenioTemplateCard
                      key={tpl.id}
                      template={tpl}
                      onActivate={() => setActivateTarget(tpl)}
                      onSend={() => { setSendingTemplate(tpl); setView("sending"); }}
                      onDelete={() => handleDelete(tpl.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Toast message={toast.message} type="success" visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
    </>
  );
}
