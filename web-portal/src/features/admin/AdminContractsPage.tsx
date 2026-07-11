import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
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
  Upload,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { Toast } from "../../shared/components/ui/Toast";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";
import {
  getAllContracts,
  sendContractFromTemplate,
  sendDocumentToThirdParty,
  uploadContractPdf,
  deleteContract,
} from "../../shared/services/contracts.service";
import { generateConsolidatedPdfBlob, tryGenerateConsolidatedPdf } from "../../shared/services/signing.service";
import { getOrgAuthorities, type OrgAuthority } from "../../shared/services/authorities.service";
import { getMyOrganization } from "../../shared/services/organizations.service";
import { getAllUsers } from "../../shared/services/admin.service";
import {
  getContractTemplates,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
  cloneContractTemplate,
  extractVariables,
  AUTO_FILL_VARS,
  VAR_LABELS,
  type DbContractTemplate,
} from "../../shared/services/contractTemplates.service";
import {
  computeInstallmentAmount,
  FREQUENCY_LABELS,
  getPaymentTemplates,
  type PaymentTemplate,
} from "../../shared/services/paymentTemplates.service";
import { DEFAULT_SIGNATURE_POSITION, type Contract, type SignaturePosition } from "../../shared/types/contract";
import type { AdminUserSummary } from "../../shared/types/user";
import { ContractDocument, ContractDetailModal } from "./components/ContractRenderer";
import { RichTextEditor } from "./components/RichTextEditor";
import { AdminConveniosTab } from "./AdminConveniosTab";
import { AdminPaymentTemplatesTab } from "./AdminPaymentTemplatesTab";

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

function CopyButton({ value }: { value: string }) {
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

function SignaturePositionEditor({
  value,
  onChange,
}: {
  value: SignaturePosition;
  onChange: (value: SignaturePosition) => void;
}) {
  function setNumber(key: "x" | "y" | "width" | "height", raw: string) {
    const next = Math.max(0, Number(raw) || 0);
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Posicion de firma</p>
        <p className="mt-1 text-xs text-zinc-400">Valores en puntos PDF, medidos desde la esquina superior izquierda.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Pagina</label>
          <select
            value={value.page === "last" ? "last" : "custom"}
            onChange={(e) => onChange({ ...value, page: e.target.value === "last" ? "last" : 0 })}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 outline-none focus:border-zinc-500"
          >
            <option value="last">Ultima</option>
            <option value="custom">Numero</option>
          </select>
        </div>
        {value.page !== "last" && (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Nro.</label>
            <input
              type="number"
              min="1"
              value={value.page + 1}
              onChange={(e) => onChange({ ...value, page: Math.max(0, (Number(e.target.value) || 1) - 1) })}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 outline-none focus:border-zinc-500"
            />
          </div>
        )}
        {(["x", "y", "width", "height"] as const).map((key) => (
          <div key={key}>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              {key === "width" ? "Ancho" : key === "height" ? "Alto" : key.toUpperCase()}
            </label>
            <input
              type="number"
              min="0"
              value={value[key]}
              onChange={(e) => setNumber(key, e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 outline-none focus:border-zinc-500"
            />
          </div>
        ))}
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
  template, onSend, onEdit, onDelete, onClone,
}: {
  template: DbContractTemplate;
  onSend:   () => void;
  onEdit:   () => void;
  onDelete: () => void;
  onClone:  () => void;
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
            className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
            title="Editar">
            <Pencil size={12} />
          </button>
          <button type="button" onClick={onClone}
            className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
            title="Clonar plantilla">
            <Copy size={12} />
          </button>
          <button type="button" onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
            title="Eliminar">
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

      <Button onClick={onSend} className="mt-auto h-9 w-full text-xs" style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
        <Send size={12} /> Enviar contrato
      </Button>
    </div>
  );
}

// ─── Sending Flow (multi-step) ────────────────────────────────────────────────

function SendingFlow({
  template,
  orgId,
  onDone,
  onBack,
}: {
  template: DbContractTemplate;
  orgId:    string;
  onDone:   (contract: Contract) => void;
  onBack:   () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=firmantes, 1=variables, 2=preview+done

  // Authorities
  const [authorities, setAuthorities]   = useState<OrgAuthority[]>([]);
  const [loadingAuth, setLoadingAuth]   = useState(true);
  const [selectedAuth, setSelectedAuth] = useState<OrgAuthority | null>(null);
  const [authSearch, setAuthSearch]     = useState("");

  // Users
  const [users, setUsers]               = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [userSearch, setUserSearch]     = useState("");

  // Payment plan
  const [paymentTemplates, setPaymentTemplates] = useState<PaymentTemplate[]>([]);
  const [loadingPayments, setLoadingPayments]   = useState(true);
  const [selectedPayment, setSelectedPayment]   = useState<PaymentTemplate | null>(null);

  // Variables
  const allVars   = useMemo(() => extractVariables(template.contentHtml), [template]);
  const adminVars = allVars.filter((v) => !AUTO_FILL_VARS.has(v));
  const autoVars  = allVars.filter((v) =>  AUTO_FILL_VARS.has(v));

  const [varValues, setVarValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    adminVars.forEach((v) => { init[v] = ""; });
    return init;
  });

  // Auto-fill user vars when user changes
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

  // Sending
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const [sentContract, setSentContract] = useState<Contract | null>(null);

  useEffect(() => {
    getOrgAuthorities(orgId)
      .then((all) => setAuthorities(all.filter((a) => a.status === "ACTIVE" && a.type === "PERMANENT")))
      .finally(() => setLoadingAuth(false));
    getAllUsers(orgId).then(setUsers).finally(() => setLoadingUsers(false));
    getPaymentTemplates().then(setPaymentTemplates).finally(() => setLoadingPayments(false));
  }, [orgId]);

  useEffect(() => {
    if (!selectedPayment) return;
    const installment = selectedPayment.installmentAmount ?? computeInstallmentAmount(selectedPayment.totalAmount, selectedPayment.installmentCount);
    setVarValues((prev) => ({
      ...prev,
      plan_pago: selectedPayment.name,
      descripcion_pago: selectedPayment.description ?? "",
      monto: String(selectedPayment.totalAmount),
      monto_total: String(selectedPayment.totalAmount),
      cuotas: String(selectedPayment.installmentCount),
      cantidad_cuotas: String(selectedPayment.installmentCount),
      valor_cuota: String(installment),
      frecuencia_pago: FREQUENCY_LABELS[selectedPayment.frequency] ?? selectedPayment.frequency,
      mora: selectedPayment.hasMora ? `${selectedPayment.moraRate}% mensual` : "Sin mora",
      tasa_mora: selectedPayment.hasMora ? String(selectedPayment.moraRate) : "0",
    }));
  }, [selectedPayment]);

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
        _paymentTemplateId: selectedPayment?.id ?? "",
        ...varValues,
  }), [template, selectedPayment, varValues]);

  async function handleSend() {
    if (!selectedAuth || !selectedUser) return;
    setSending(true);
    setError("");
    try {
      const templateFields: Record<string, string> = {
        _templateContent: template.contentHtml,
        _legalTitle:      template.name,
        _dbTemplateId:    template.id,
        _paymentTemplateId: selectedPayment?.id ?? "",
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
        paymentTemplateId: selectedPayment?.id ?? null,
        signaturePosition: template.signaturePosition,
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
          <h3 className="text-xl font-bold text-zinc-900">Contrato enviado</h3>
          <p className="text-sm text-zinc-500 mt-2">
            <strong>{selectedUser?.fullName}</strong> verá el contrato pendiente en su panel.<br />
            Firma por Escencial: <strong>{selectedAuth?.fullName}</strong>.
          </p>
        </div>
        <Button onClick={onBack} className="h-10 px-6 mt-2">Ver contratos</Button>
      </div>
    );
  }

  // ── Step 0: Seleccionar firmantes ──
  if (step === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-zinc-400">Elegí la autoridad que firma por Escencial SAS y el usuario que recibirá el contrato.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Autoridad */}
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

          {/* Destinatario */}
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

  // ── Step 1: Variables + datos del usuario ──
  if (step === 1) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Variables a completar */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Variables del contrato</p>

            {/* Auto-fill (usuario) */}
            {autoVars.length > 0 && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Auto-completadas del usuario</p>
                {autoVars.map((v) => (
                  <div key={v} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-emerald-700">{"{{"}{v}{"}}"}</span>
                    <span className="text-[11px] text-emerald-800 font-semibold truncate max-w-[140px]">
                      {varValues[v] || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Admin vars */}
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

          {/* Datos del usuario (referencia) */}
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Plan de pago</p>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                {loadingPayments ? (
                  <p className="text-xs text-zinc-400">Cargando planes de pago...</p>
                ) : paymentTemplates.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-zinc-800">Sin plantillas de pago</p>
                    <p className="text-xs text-zinc-500">Creá una desde la pestaña Pagos para poder asociarla al contrato.</p>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedPayment?.id ?? ""}
                      onChange={(e) => setSelectedPayment(paymentTemplates.find((p) => p.id === e.target.value) ?? null)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-500 transition"
                    >
                      <option value="">Sin plan de pago</option>
                      {paymentTemplates.map((payment) => (
                        <option key={payment.id} value={payment.id}>
                          {payment.name}
                        </option>
                      ))}
                    </select>
                    {selectedPayment ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-emerald-700">Monto total</span>
                          <strong>${selectedPayment.totalAmount.toLocaleString("es-AR")}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-emerald-700">Cuotas</span>
                          <strong>{selectedPayment.installmentCount} x ${(selectedPayment.installmentAmount ?? computeInstallmentAmount(selectedPayment.totalAmount, selectedPayment.installmentCount)).toLocaleString("es-AR")}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-emerald-700">Frecuencia</span>
                          <strong>{FREQUENCY_LABELS[selectedPayment.frequency] ?? selectedPayment.frequency}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-emerald-700">Mora</span>
                          <strong>{selectedPayment.hasMora ? `${selectedPayment.moraRate}%` : "No aplica"}</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400">Opcional. Si lo seleccionás, queda asociado al contrato y completa las variables de pago.</p>
                    )}
                  </>
                )}
              </div>
            </div>

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
                        {value !== "—" && <CopyButton value={value} />}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 pt-1">
                  Los datos del usuario se mapean automáticamente a las variables del contrato marcadas en verde.
                  Podés copiar cualquier dato para usarlo en una variable manual.
                </p>
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
              {sending ? "Enviando..." : <><Send size={14} /> Enviar contrato</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Preview ──
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Vista previa con todos los datos. Las variables en verde son del usuario.</p>
        <Button variant="secondary" onClick={() => setStep(1)} className="h-8 px-3 text-xs text-zinc-700">
          <Pencil size={11} /> Editar
        </Button>
      </div>
      <ContractDocument templateId="custom" fields={previewFields} alumnos={[]} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setStep(1)} className="h-10 px-5 text-zinc-700">
          <ArrowLeft size={14} /> Atrás
        </Button>
        <Button onClick={handleSend} disabled={sending} className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white">
          {sending ? "Enviando..." : <><Send size={14} /> Enviar contrato</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageView = "list" | "templates" | "editor" | "sending";

export function AdminContractsPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "contracts" | "upload" | "convenios" | "payments">("contracts");
  const [orgId, setOrgId]         = useState<string | null>(null);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "pending" | "signed" | "rejected">("all");
  const [search, setSearch]       = useState("");
  const [viewContract, setViewContract]     = useState<Contract | null>(null);
  const [sendThirdParty, setSendThirdParty] = useState<Contract | null>(null);
  const [preparingPdfId, setPreparingPdfId] = useState<string | null>(null);

  const [dbTemplates, setDbTemplates]           = useState<DbContractTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [view, setView] = useState<PageView>("list");

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<DbContractTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplSignaturePosition, setTplSignaturePosition] = useState<SignaturePosition>(DEFAULT_SIGNATURE_POSITION);
  const [savingTpl, setSavingTpl] = useState(false);

  // Sending state
  const [sendingTemplate, setSendingTemplate] = useState<DbContractTemplate | null>(null);

  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as "success" | "error" });
  const showToast = (message: string, type: "success" | "error" = "success") => setToast({ visible: true, message, type });

  useEffect(() => {
    getAllContracts().then((c) => { setContracts(c); setLoading(false); });
    getMyOrganization().then((org) => {
      if (!org) return;
      setOrgId(org.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoadingTemplates(true);
    getContractTemplates(orgId).then(setDbTemplates).finally(() => setLoadingTemplates(false));
  }, [orgId]);

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
    setTplSignaturePosition(DEFAULT_SIGNATURE_POSITION);
    setView("editor");
  }

  function openEditTemplate(tpl: DbContractTemplate) {
    setEditingTemplate(tpl);
    setTplName(tpl.name); setTplDesc(tpl.description); setTplHtml(tpl.contentHtml);
    setTplSignaturePosition(tpl.signaturePosition);
    setView("editor");
  }

  async function handleSaveTemplate() {
    const htmlContent = tplHtml.replace(/<[^>]+>/g, "").trim();
    if (!tplName.trim() || !htmlContent) return;
    setSavingTpl(true);
    try {
      if (editingTemplate) {
        await updateContractTemplate(editingTemplate.id, {
          name: tplName,
          description: tplDesc,
          contentHtml: tplHtml,
          signaturePosition: tplSignaturePosition,
        });
        setDbTemplates((prev) => prev.map((t) => t.id === editingTemplate.id
          ? { ...t, name: tplName, description: tplDesc, contentHtml: tplHtml, signaturePosition: tplSignaturePosition }
          : t));
        showToast("Plantilla actualizada.");
      } else if (orgId) {
        const created = await createContractTemplate({
          orgId,
          name: tplName,
          description: tplDesc,
          contentHtml: tplHtml,
          signaturePosition: tplSignaturePosition,
        });
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
    if (!window.confirm("¿Eliminar esta plantilla?")) return;
    await deleteContractTemplate(id);
    setDbTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast("Plantilla eliminada.");
  }

  async function handleCloneTemplate(id: string) {
    try {
      const cloned = await cloneContractTemplate(id);
      setDbTemplates((prev) => [cloned, ...prev]);
      showToast("Plantilla clonada.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al clonar");
    }
  }

  async function openSignedPdf(contract: Contract) {
    setPreparingPdfId(contract.id);
    try {
      const pdfBlob = await generateConsolidatedPdfBlob(contract.id);
      if (!pdfBlob) {
        if (contract.finalPdfUrl) {
          window.open(`${contract.finalPdfUrl}${contract.finalPdfUrl.includes("?") ? "&" : "?"}v=${Date.now()}`, "_blank", "noopener,noreferrer");
          return;
        }
        window.alert("No se pudo preparar el PDF completo. Verificá que el documento tenga firmas registradas y una versión PDF original.");
        return;
      }

      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      void tryGenerateConsolidatedPdf(contract.id);
    } finally {
      setPreparingPdfId(null);
    }
  }

  async function handleDeleteContract(contract: Contract) {
    if (!window.confirm(`¿Eliminar el contrato "${contract.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteContract(contract.id);
      setContracts((prev) => prev.filter((c) => c.id !== contract.id));
      showToast("Contrato eliminado.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar contrato", "error");
    }
  }

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

        <RichTextEditor value={tplHtml} onChange={setTplHtml}
          placeholder="Redactá el contrato. Usá las variables del panel derecho para insertar datos dinámicos..." />

        <SignaturePositionEditor value={tplSignaturePosition} onChange={setTplSignaturePosition} />

        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setView("templates")} className="h-10 px-5 text-zinc-700">
            <ArrowLeft size={14} /> Cancelar
          </Button>
          <Button onClick={handleSaveTemplate} disabled={!isValid || savingTpl} className="h-10 px-6">
            {savingTpl ? "Guardando..." : <><Check size={14} /> {editingTemplate ? "Guardar cambios" : "Crear plantilla"}</>}
          </Button>
        </div>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
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
              <p className="text-sm text-zinc-400 mt-1">Creá tu primera plantilla para poder enviar contratos.</p>
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
                onSend={() => { setSendingTemplate(tpl); setView("sending"); }}
                onEdit={() => openEditTemplate(tpl)}
                onDelete={() => handleDeleteTemplate(tpl.id)}
                onClone={() => handleCloneTemplate(tpl.id)}
              />
            ))}
          </div>
        )}

        <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
      </div>
    );
  }

  // ─── Sending view ──────────────────────────────────────────────────────────

  if (view === "sending" && sendingTemplate && orgId) {
    return (
      <div className="min-h-screen space-y-6">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setView("templates")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-xs text-zinc-600">Admin · Plantillas · Enviar</p>
            <h2 className="font-bold text-zinc-900">{sendingTemplate.name}</h2>
          </div>
        </div>

        <SendingFlow
          template={sendingTemplate}
          orgId={orgId}
          onDone={(contract) => {
            setContracts((prev) => [contract, ...prev]);
            showToast("Contrato enviado exitosamente.");
          }}
          onBack={() => setView("list")}
        />

        <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={() => setToast((t) => ({ ...t, visible: false }))} duration={4000} />
      </div>
    );
  }

  // ─── List view ─────────────────────────────────────────────────────────────

  return (
    <>
      {viewContract && (
        <ContractDetailModal
          contract={viewContract}
          onClose={() => setViewContract(null)}
          onUpdated={(updated) => {
            setViewContract(updated);
            setContracts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
          }}
        />
      )}
      {sendThirdParty && (
        <SendThirdPartyModal contract={sendThirdParty} onClose={() => setSendThirdParty(null)}
          onSent={(id) => setContracts((prev) => prev.map((x) => x.id === id ? { ...x, status: "SENT", totalSigners: x.totalSigners + 1 } : x))} />
      )}

      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">Documentos</h1>
          </div>
          <div className="flex items-center gap-1 border-b border-zinc-200">
            {([
              { key: "templates", label: "Modelos" },
              { key: "contracts", label: "Contratos" },
              { key: "upload", label: "Subir PDF" },
              { key: "convenios", label: "Convenios" },
              { key: "payments", label: "Pagos" },
            ] as const).map((tab) => (
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

        {activeTab === "payments" && <AdminPaymentTemplatesTab />}

        {activeTab === "upload" && <AdminUploadPdfTab />}

        {activeTab === "templates" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{dbTemplates.length} plantillas creadas</p>
              <Button onClick={openNewTemplate} className="h-10 px-4 shrink-0">
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
                  <p className="text-sm text-zinc-400 mt-1">Creá tu primera plantilla para enviar contratos.</p>
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
                    onSend={() => { setSendingTemplate(tpl); setView("sending"); }}
                    onEdit={() => openEditTemplate(tpl)}
                    onDelete={() => handleDeleteTemplate(tpl.id)}
                    onClone={() => handleCloneTemplate(tpl.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "contracts" && (
          <>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-zinc-500">{contracts.filter((c) => c.status !== "DRAFT").length} contratos enviados</p>
              <div className="flex gap-2">
                {dbTemplates.length > 0 && (
                  <Button onClick={() => setView("templates")} className="h-10 px-4 shrink-0" variant="secondary">
                    <LayoutTemplate size={14} /> Plantillas
                  </Button>
                )}
                <Button onClick={() => setActiveTab("upload")} className="h-10 px-4 shrink-0">
                  <Upload size={14} /> Subir PDF
                </Button>
              </div>
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
                  <button type="button" onClick={() => setView("templates")}
                    className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-700">
                    Ir a Plantillas para enviar
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filtered.map((c) => {
                    const { label, className } = statusMeta(c.status);
                    const hasSignedPdf = c.status === "SIGNED" || c.status === "COMPLETED" || c.completedSigners > 0;
                    const isPreparingPdf = preparingPdfId === c.id;
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
                              {c.ownerEmail} · {new Date(c.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.status !== "DRAFT" && (
                            <span className="text-xs text-zinc-600 hidden sm:inline">{c.completedSigners}/{c.totalSigners} firmas</span>
                          )}
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>
                          {c.status === "COMPLETED" && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setSendThirdParty(c); }}
                              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-100 transition">
                              <Send size={11} /> Enviar al tercero
                            </button>
                          )}
                          {hasSignedPdf && (
                            <button type="button"
                              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition"
                              disabled={isPreparingPdf}
                              onClick={(e) => {
                                e.stopPropagation();
                                void openSignedPdf(c);
                              }}>
                              <Download size={11} /> {isPreparingPdf ? "Preparando..." : "PDF firmado"}
                            </button>
                          )}
                          <button type="button" onClick={() => setViewContract(c)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 hover:bg-zinc-50 transition opacity-0 group-hover:opacity-100">
                            <Eye size={11} /> Ver
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteContract(c); }}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                            <Trash2 size={11} />
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

// ─── Upload PDF Tab ────────────────────────────────────────────────────────────

function AdminUploadPdfTab() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerCuil, setSignerCuil] = useState("");
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition>(DEFAULT_SIGNATURE_POSITION);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!file || !signerName.trim() || !signerEmail.trim() || !user?.id) return;
    setSending(true);
    setError("");
    try {
      await uploadContractPdf({
        file,
        title: title.trim() || file.name,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        signerCuil: signerCuil.trim() || undefined,
        ownerId: user.id,
        signaturePosition,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir PDF");
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setFile(null);
    setTitle("");
    setSignerName("");
    setSignerEmail("");
    setSignerCuil("");
    setSignaturePosition(DEFAULT_SIGNATURE_POSITION);
    setDone(false);
    setError("");
  }

  const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition";

  if (done) {
    return (
      <div className="flex flex-col items-center py-16 text-center max-w-sm mx-auto gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 border border-emerald-200">
          <Check size={36} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900">PDF enviado a firmar</h3>
          <p className="text-sm text-zinc-500 mt-2">{signerName} recibió el documento y puede firmarlo.</p>
        </div>
        <Button onClick={resetForm} className="h-10 px-6 mt-2">
          <Upload size={14} /> Subir otro PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <p className="text-sm text-zinc-500">Subí un PDF para enviarlo a firmar digitalmente.</p>
      </div>

      <div className="space-y-4">
        {/* PDF file */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Archivo PDF *</label>
          <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 transition ${file ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"}`}>
            <Upload size={24} className={file ? "text-emerald-500" : "text-zinc-400"} />
            {file ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-800">{file.name}</p>
                <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-600">Hacé clic para seleccionar un PDF</p>
                <p className="text-xs text-zinc-400 mt-1">o arrastrá el archivo aquí</p>
              </div>
            )}
            <input type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.type === "application/pdf") setFile(f);
                else setError("Solo se aceptan archivos PDF");
              }} />
          </label>
        </div>

        <Input label="Título del documento (opcional)" value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder={file?.name ?? "Ej: Contrato de servicios"} />

        <Input label="Nombre del firmante *" value={signerName}
          onChange={(e) => setSignerName(e.target.value)} placeholder="Juan José Gimenez" />

        <Input label="Email del firmante *" type="email" value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)} placeholder="juan@ejemplo.com" />

        <Input label="CUIL / CUIT (opcional)" value={signerCuil}
          onChange={(e) => setSignerCuil(e.target.value)} placeholder="20-40123456-7" />

        <SignaturePositionEditor value={signaturePosition} onChange={setSignaturePosition} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!file || !signerName.trim() || !signerEmail.trim() || sending} className="h-12 w-full">
        {sending ? "Subiendo y enviando..." : <><Upload size={15} /> Subir PDF y enviar a firmar</>}
      </Button>
    </div>
  );
}
