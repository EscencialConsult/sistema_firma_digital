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
  Mail,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  ORG_VARS,
  SYSTEM_VARS,
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
import { downloadBlob, signedPdfDownloadUrl, signedPdfFileName } from "../../shared/utils/downloadFileName";
import { buildSignedPdfsEmail } from "../../shared/utils/shareEmail";
import { ContractDocument, ContractDetailModal } from "./components/ContractRenderer";
import { RichTextEditor } from "./components/RichTextEditor";
import { loadOrgCache } from "../../shared/config/orgCache";
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

type EmailProvider = "mailto" | "gmail" | "outlook";

function openEmailComposer(provider: EmailProvider, input: { to: string; subject: string; body: string }) {
  const encodedTo = encodeURIComponent(input.to);
  const encodedSubject = encodeURIComponent(input.subject);
  const encodedBody = encodeURIComponent(input.body);
  const toParam = input.to.trim() ? `to=${encodedTo}&` : "";
  const mailtoTo = input.to.trim() ? encodedTo : "";
  const href = provider === "gmail"
    ? `https://mail.google.com/mail/?view=cm&fs=1&${toParam}su=${encodedSubject}&body=${encodedBody}`
    : provider === "outlook"
      ? `https://outlook.office.com/mail/deeplink/compose?${toParam}subject=${encodedSubject}&body=${encodedBody}`
      : `mailto:${mailtoTo}?subject=${encodedSubject}&body=${encodedBody}`;

  window.open(href, "_blank", "noopener,noreferrer");
}

function hasShareableSignedPdf(contract: Contract) {
  return contract.status === "SIGNED" || contract.status === "COMPLETED" || contract.completedSigners > 0;
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
  const vars        = extractVariables(template.contentHtml);
  const autoVars    = vars.filter((v) => AUTO_FILL_VARS.has(v));
  const orgVars     = vars.filter((v) => ORG_VARS.has(v) && !AUTO_FILL_VARS.has(v));
  const systemVars  = vars.filter((v) => SYSTEM_VARS.has(v));
  const customVars  = vars.filter((v) => !AUTO_FILL_VARS.has(v) && !ORG_VARS.has(v) && !SYSTEM_VARS.has(v));
  const [showDesc, setShowDesc] = useState(false);
  const [showVars, setShowVars] = useState(false);

  return (
    <div className="group border-b border-zinc-100 last:border-0">
      {/* Fila principal */}
      <div className="flex items-center gap-3 px-1 py-3 hover:bg-zinc-50/60 rounded-xl transition">
        <FileText size={14} className="shrink-0 text-zinc-400" />

        {/* Nombre + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{template.name}</p>
            {template.label && (
              <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                {template.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{new Date(template.createdAt).toLocaleDateString("es-AR")}</span>
            <span className="text-zinc-300">·</span>
            <span className="font-semibold text-zinc-500">v1.{template.versionMinor ?? 0}</span>
            {vars.length > 0 && (
              <>
                <span className="text-zinc-300">·</span>
                <button type="button" onClick={() => setShowVars((v) => !v)}
                  className="hover:text-zinc-600 transition hover:underline underline-offset-2">
                  {(systemVars.length + customVars.length) > 0 && <>{systemVars.length + customVars.length} variable{(systemVars.length + customVars.length) !== 1 ? "s" : ""}</>}
                  {(systemVars.length + customVars.length) > 0 && (orgVars.length > 0 || autoVars.length > 0) && <span className="mx-0.5 text-zinc-300">·</span>}
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
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
          <button type="button" onClick={onEdit} title="Editar"
            className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
            <Pencil size={12} />
          </button>
          <button type="button" onClick={onClone} title="Clonar"
            className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
            <Copy size={12} />
          </button>
          <button type="button" onClick={onDelete} title="Eliminar"
            className="grid h-7 w-7 place-items-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition">
            <Trash2 size={12} />
          </button>
        </div>

        {/* Enviar */}
        <button type="button" onClick={onSend}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 h-8 text-[11px] font-semibold transition"
          style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
          <Send size={11} /> Enviar
        </button>
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

      {/* Descripción expandible */}
      {showDesc && template.description && (
        <p className="px-6 pb-3 text-xs text-zinc-500 leading-relaxed">{template.description}</p>
      )}
    </div>
  );
}

// ─── Sending Flow (multi-step) ────────────────────────────────────────────────

function SendingFlow({
  template,
  orgId,
  orgName,
  onDone,
  onBack,
}: {
  template: DbContractTemplate;
  orgId:    string;
  orgName:  string | null;
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

  // Org data para sugerencias de variables
  const [orgData, setOrgData] = useState<import("../../shared/types/organization").Organization | null>(null);
  useEffect(() => { getMyOrganization().then(setOrgData).catch(() => null); }, []);

  // Mapa: nombre de variable → campo del org para sugerir auto-completado
  const ORG_VAR_SUGGESTIONS: Record<string, (o: NonNullable<typeof orgData>, auth: OrgAuthority | null) => string | null | undefined> = {
    representante_consultora: (o, a) => a?.fullName ?? null,
    representante_empresa:    (o, a) => a?.fullName ?? null,
    razon_social_consultora:  (o)    => o.name,
    razon_social_empresa:     (o)    => o.name,
    nombre_consultora:        (o)    => o.name,
    nombre_empresa:           (o)    => o.name,
    cuit_consultora:          (o)    => o.taxId,
    cuit_empresa:             (o)    => o.taxId,
    domicilio_consultora:     (o)    => [o.address, o.city].filter(Boolean).join(", ") || null,
    domicilio_empresa:        (o)    => [o.address, o.city].filter(Boolean).join(", ") || null,
    ciudad_consultora:        (o)    => o.city,
    ciudad_empresa:           (o)    => o.city,
    provincia_consultora:     (o)    => o.province,
    provincia_empresa:        (o)    => o.province,
    email_consultora:         (o)    => o.contactEmail,
    email_empresa:            (o)    => o.contactEmail,
    telefono_consultora:      (o)    => o.phone,
    telefono_empresa:         (o)    => o.phone,
  };

  function getOrgSuggestion(varName: string): string | null {
    if (!orgData) return null;
    const fn = ORG_VAR_SUGGESTIONS[varName];
    if (!fn) return null;
    const val = fn(orgData, selectedAuth);
    return val?.trim() || null;
  }

  // Variables
  const allVars   = useMemo(() => extractVariables(template.contentHtml), [template]);
  const adminVars = allVars.filter((v) => !AUTO_FILL_VARS.has(v) && !ORG_VARS.has(v));
  const autoVars  = allVars.filter((v) =>  AUTO_FILL_VARS.has(v));
  const orgAutoVars = allVars.filter((v) => ORG_VARS.has(v));

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
        _templateContent:  template.contentHtml,
        _legalTitle:       template.name,
        _dbTemplateId:     template.id,
        _paymentTemplateId: selectedPayment?.id ?? "",
        _logoHeader:       template.logoHeader    ? "1" : "0",
        _logoWatermark:    template.logoWatermark ? "1" : "0",
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {/* Ícono de éxito con color de marca */}
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center mb-6 shadow-lg"
          style={{ background: "var(--brand-primary)" }}
        >
          <Check size={44} strokeWidth={2.5} style={{ color: "var(--brand-primary-text)" }} />
        </div>

        <h2 className="text-2xl font-bold text-zinc-900 mb-1">¡Contrato enviado!</h2>
        <p className="text-sm text-zinc-400 mb-8 max-w-xs">
          El contrato fue generado y está listo para ser firmado.
        </p>

        {/* Cards de resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mb-8 text-left">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Destinatario</p>
            <p className="text-sm font-semibold text-zinc-800">{selectedUser?.fullName ?? "—"}</p>
            <p className="text-xs text-zinc-400">{selectedUser?.email ?? ""}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Firma autoridad</p>
            <p className="text-sm font-semibold text-zinc-800">{selectedAuth?.fullName ?? "—"}</p>
            <p className="text-xs text-zinc-400">{orgName ?? ""}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-0.5 sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Plantilla</p>
            <p className="text-sm font-semibold text-zinc-800">{template.name}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack} className="h-10 px-5 text-zinc-700">
            Ver contratos
          </Button>
          <Button
            onClick={() => {
              setDone(false);
              setSentContract(null);
              setStep(0);
              setSelectedAuth(null);
              setSelectedUser(null);
              setVarValues({});
            }}
            className="h-10 px-6"
            style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}
          >
            <Send size={14} /> Enviar otro
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 0: Seleccionar firmantes ──
  if (step === 0) {
    const SelectorCard = ({
      title, subtitle, icon: Icon, useBrand, search, onSearch, loading, items, selected, onSelect,
    }: {
      title: string; subtitle: string; icon: React.ElementType; useBrand?: boolean;
      search: string; onSearch: (v: string) => void; loading: boolean;
      items: { id: string; label: string; sub: string }[];
      selected: string | null; onSelect: (id: string) => void;
    }) => (
      <div className="flex flex-col rounded-2xl border border-zinc-200/70 bg-white overflow-hidden shadow-sm">
        {/* Header con color de marca */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={useBrand
            ? { background: "var(--brand-primary)", color: "var(--brand-primary-text)" }
            : { background: "var(--brand-accent, #3f3f46)", color: "#fff" }
          }
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
            <Icon size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{title}</p>
            <p className="text-[11px] opacity-60">{subtitle}</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 focus-within:border-zinc-300 focus-within:bg-white transition">
            <Search size={13} className="text-zinc-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 outline-none"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto max-h-60 px-2 pb-3">
          {loading ? (
            <div className="space-y-1.5 p-2">
              {Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400">Sin resultados</p>
          ) : (
            <div className="space-y-0.5 pt-1">
              {items.map((item) => {
                const isSelected = selected === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98]"
                    style={isSelected
                      ? { background: "var(--brand-primary)", color: "var(--brand-primary-text)" }
                      : { color: "#3f3f46" }
                    }
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold"
                      style={isSelected ? { background: "rgba(255,255,255,0.2)", color: "inherit" } : { background: "#e4e4e7", color: "#52525b" }}
                    >
                      {item.label[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{item.label}</p>
                      <p className="text-xs truncate opacity-60">{item.sub}</p>
                    </div>
                    {isSelected && <Check size={14} className="shrink-0 opacity-80" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div className="space-y-5">
        <p className="text-sm text-zinc-400">Seleccioná la autoridad que firma en nombre de <strong className="text-zinc-700">{orgName ?? "la empresa"}</strong> y el destinatario que recibirá el contrato.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectorCard
            title="Autoridad firmante"
            subtitle={orgName ?? "Firma en nombre de la empresa"}
            icon={ShieldCheck}
            useBrand
            search={authSearch}
            onSearch={setAuthSearch}
            loading={loadingAuth}
            items={filteredAuth.map(a => ({ id: a.id, label: a.fullName, sub: a.cuil || a.email || "" }))}
            selected={selectedAuth?.id ?? null}
            onSelect={(id) => setSelectedAuth(filteredAuth.find(a => a.id === id) ?? null)}
          />
          <SelectorCard
            title="Destinatario"
            subtitle="Quien recibe y firma el contrato"
            icon={User}
            search={userSearch}
            onSearch={setUserSearch}
            loading={loadingUsers}
            items={filteredUsers.map(u => ({ id: u.id, label: u.fullName, sub: u.email }))}
            selected={selectedUser?.id ?? null}
            onSelect={(id) => setSelectedUser(filteredUsers.find(u => u.id === id) ?? null)}
          />
        </div>

        <div className="flex justify-between pt-3 border-t border-zinc-100">
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
      <div className="space-y-5">

        {/* ── Banner firmante ── */}
        {selectedUser && (
          <div className="rounded-2xl overflow-hidden border border-zinc-200/60 shadow-sm">
            <div className="flex items-center gap-4 px-5 py-4" style={{ background: "var(--brand-primary)", color: "var(--brand-primary-text)" }}>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 text-base font-bold">
                {selectedUser.fullName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base leading-tight truncate">{selectedUser.fullName}</p>
                <p className="text-sm opacity-70 truncate">{selectedUser.email}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6 text-sm">
                {[
                  { label: "DNI",  value: selectedUser.documentNumber },
                  { label: "CUIL", value: selectedUser.cuilCuit },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
                    <p className="font-bold">{value}</p>
                  </div>
                ) : null)}
              </div>
            </div>
          </div>
        )}

        {/* ── Cuerpo: 2 columnas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">

          {/* ── Izq: Variables automáticas + Plan de pago ── */}
          <div className="space-y-5">

            {/* Auto vars */}
            {autoVars.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Variables automáticas</p>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed -mt-1">
                  Se completan solos con los datos del firmante. Click para copiar.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {autoVars.map((v) => {
                    const label = VAR_LABELS[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    const value = varValues[v] ?? "";
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => value && navigator.clipboard.writeText(value)}
                        title={value ? `Copiar: ${value}` : "Sin datos"}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[0.98]"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500 mb-0.5">{label}</p>
                          <p className="text-sm font-semibold text-emerald-950 truncate">
                            {value || <span className="italic font-normal text-emerald-400 text-xs">Sin datos</span>}
                          </p>
                        </div>
                        <Copy size={13} className="shrink-0 text-emerald-300 transition group-hover:text-emerald-600" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Plan de pago */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-300 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Plan de pago</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                {loadingPayments ? (
                  <p className="text-xs text-zinc-400">Cargando...</p>
                ) : paymentTemplates.length === 0 ? (
                  <p className="text-xs text-zinc-500">Sin plantillas de pago. Creá una en la pestaña Pagos.</p>
                ) : (
                  <>
                    <select
                      value={selectedPayment?.id ?? ""}
                      onChange={(e) => setSelectedPayment(paymentTemplates.find((p) => p.id === e.target.value) ?? null)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 transition"
                    >
                      <option value="">Sin plan de pago</option>
                      {paymentTemplates.map((payment) => (
                        <option key={payment.id} value={payment.id}>{payment.name}</option>
                      ))}
                    </select>
                    {selectedPayment && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {[
                          { label: "Total",      value: `$${selectedPayment.totalAmount.toLocaleString("es-AR")}` },
                          { label: "Cuotas",     value: `${selectedPayment.installmentCount} x $${(selectedPayment.installmentAmount ?? computeInstallmentAmount(selectedPayment.totalAmount, selectedPayment.installmentCount)).toLocaleString("es-AR")}` },
                          { label: "Frecuencia", value: FREQUENCY_LABELS[selectedPayment.frequency] ?? selectedPayment.frequency },
                          { label: "Mora",       value: selectedPayment.hasMora ? `${selectedPayment.moraRate}%` : "No aplica" },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-xl bg-zinc-50 border border-zinc-100 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-0.5">{label}</p>
                            <p className="text-sm font-bold text-zinc-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Der: Variables manuales ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Completar manualmente</p>
            </div>

            {adminVars.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                <p className="text-sm text-zinc-400">Esta plantilla no tiene variables manuales.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {adminVars.map((v) => {
                    const isLong = v.includes("objeto") || v.includes("descripcion");
                    const isDate = v.includes("fecha");
                    const isNum  = v.includes("monto") || v.includes("cuotas") || v.includes("valor");
                    const label  = VAR_LABELS[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    const filled = !!(varValues[v] ?? "").trim();
                    const spanFull = isLong || isDate;
                    const suggestion = getOrgSuggestion(v);
                    const showSuggestion = suggestion && !filled;
                    return (
                      <div key={v} className={`space-y-1.5 ${spanFull ? "sm:col-span-2" : ""}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${filled ? "bg-emerald-500" : suggestion ? "bg-blue-400" : "bg-amber-400"}`} />
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{label}</label>
                        </div>
                        {isLong ? (
                          <textarea
                            value={varValues[v] ?? ""}
                            rows={3}
                            placeholder={`Ingresá ${label.toLowerCase()}...`}
                            onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-100 transition resize-none"
                          />
                        ) : (
                          <input
                            type={isDate ? "date" : isNum ? "number" : "text"}
                            value={varValues[v] ?? ""}
                            placeholder={`Ingresá ${label.toLowerCase()}...`}
                            onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-300 outline-none focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-100 transition"
                          />
                        )}
                        {showSuggestion && (
                          <button
                            type="button"
                            onClick={() => setVarValues((p) => ({ ...p, [v]: suggestion! }))}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-medium hover:bg-blue-100 transition-colors">
                              <Check size={10} strokeWidth={2.5} />
                              Usar: {suggestion}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {autoVars.length === 0 && adminVars.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                <p className="text-sm text-zinc-400">Esta plantilla no tiene variables — se enviará tal como está.</p>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-between pt-4 border-t border-zinc-100">
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
      <ContractDocument templateId="custom" fields={previewFields} alumnos={[]} logoHeader={template.logoHeader} logoWatermark={template.logoWatermark} />
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

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  contract,
  onClose,
  onConfirm,
  deleting,
}: {
  contract: Contract;
  onClose:  () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [input, setInput] = useState("");
  const confirmed = input.trim().toLowerCase() === "eliminar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-5">
        <div className="space-y-1">
          <h3 className="font-bold text-zinc-900 text-base">Eliminar contrato</h3>
          <p className="text-xs text-zinc-500 truncate">"{contract.title}"</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-600 leading-relaxed">
            Esta acción no se puede deshacer. El contrato y todos sus registros de auditoría serán eliminados de forma permanente.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500">
            Escribí <span className="font-bold text-zinc-900">eliminar</span> para confirmar
          </label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="eliminar"
            autoFocus
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 transition"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!confirmed || deleting}
            onClick={onConfirm}
            className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition ${
              confirmed && !deleting
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            }`}
          >
            <Check size={14} />
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageView = "list" | "templates" | "editor" | "sending";

export function AdminContractsPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "contracts" | "upload" | "convenios" | "payments">("contracts");
  const [orgId, setOrgId]         = useState<string | null>(null);
  const [orgName, setOrgName]     = useState<string | null>(null);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "pending" | "signed" | "rejected">("all");
  const [search, setSearch]       = useState("");
  const [viewContract, setViewContract]     = useState<Contract | null>(null);
  const [sendThirdParty, setSendThirdParty] = useState<Contract | null>(null);
  const [preparingPdfId, setPreparingPdfId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePreparing, setSharePreparing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareTo, setShareTo] = useState("");
  const [shareSubject, setShareSubject] = useState("");
  const [shareBody, setShareBody] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const [dbTemplates, setDbTemplates]           = useState<DbContractTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [view, setView] = useState<PageView>("list");

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<DbContractTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplLabel, setTplLabel] = useState("");
  const [tplLogoHeader, setTplLogoHeader] = useState(false);
  const [tplLogoWatermark, setTplLogoWatermark] = useState(false);
  const [tplHtml, setTplHtml] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false);
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
      setOrgName(org.name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoadingTemplates(true);
    getContractTemplates(orgId).then(setDbTemplates).finally(() => setLoadingTemplates(false));
  }, [orgId]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = contracts;
    if (filter === "pending") list = list.filter((c) => ["SENT","VIEWED","CONFORMITY_ACCEPTED"].includes(c.status));
    else if (filter === "signed") list = list.filter((c) => ["SIGNED","COMPLETED"].includes(c.status));
    else if (filter === "rejected") list = list.filter((c) => ["REJECTED","EXPIRED"].includes(c.status));
    if (search) {
      const q = search.toLowerCase();
      const signerOf = (c: Contract) =>
        (c.templateFields?.nombre_firmante ?? c.templateFields?.nombre_usuario ?? "").toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q) ||
        signerOf(c).includes(q)
      );
    }
    return list;
  }, [contracts, filter, search]);

  const contractGroups = useMemo(() => {
    const map = new Map<string, Contract[]>();
    for (const c of filtered) {
      const key = c.templateId ?? `pdf:${c.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([key, cs]) => {
      const tpl = cs[0].templateId ? dbTemplates.find((t) => t.id === cs[0].templateId) : null;
      const vars     = tpl ? extractVariables(tpl.contentHtml) : [];
      const orgVars  = vars.filter((v) => ORG_VARS.has(v));
      const autoVars = vars.filter((v) => AUTO_FILL_VARS.has(v));
      const adminVarsCount = vars.filter((v) => !ORG_VARS.has(v) && !AUTO_FILL_VARS.has(v)).length;
      return {
        key,
        title: cs[0].title,
        isTemplate: !!cs[0].templateId,
        contracts: cs,
        template: tpl ?? null,
        vars, orgVars, autoVars, adminVarsCount,
        signedCount:   cs.filter((c) => ["SIGNED","COMPLETED"].includes(c.status)).length,
        pendingCount:  cs.filter((c) => ["SENT","VIEWED","CONFORMITY_ACCEPTED"].includes(c.status)).length,
        rejectedCount: cs.filter((c) => ["REJECTED","EXPIRED"].includes(c.status)).length,
      };
    });
  }, [filtered, dbTemplates]);

  const selectedSignedContracts = contracts.filter((c) =>
    selectedContractIds.includes(c.id) && hasShareableSignedPdf(c)
  );
  const visibleSignedContracts = filtered.filter(hasShareableSignedPdf);
  const allVisibleSignedSelected = visibleSignedContracts.length > 0 &&
    visibleSignedContracts.every((c) => selectedContractIds.includes(c.id));

  function toggleSelectedContract(id: string) {
    setSelectedContractIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function toggleVisibleSignedContracts() {
    if (allVisibleSignedSelected) {
      const visibleIds = new Set(visibleSignedContracts.map((c) => c.id));
      setSelectedContractIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    setSelectedContractIds((current) =>
      Array.from(new Set([...current, ...visibleSignedContracts.map((c) => c.id)]))
    );
  }

  async function prepareShareDraft() {
    if (selectedSignedContracts.length === 0) return;
    setSharePreparing(true);
    setShareError(null);
    setShareCopied(false);

    try {
      const prepared = await Promise.all(selectedSignedContracts.map(async (contract) => {
        const url = contract.finalPdfUrl ?? await tryGenerateConsolidatedPdf(contract.id);
        return {
          title: contract.title,
          ownerEmail: contract.ownerEmail,
          fileName: signedPdfFileName({
            title: contract.title,
            fileName: contract.fileName,
            sequence: contract.versionNumber,
          }),
          url: url ? signedPdfDownloadUrl(contract.id) : null,
        };
      }));

      const withLinks = prepared.filter((item): item is typeof item & { url: string } => !!item.url);
      if (withLinks.length === 0) {
        setShareError("No se pudieron preparar links de descarga para los PDFs seleccionados.");
        return;
      }

      const { subject, body } = buildSignedPdfsEmail({ documents: withLinks, organizationName: orgName ?? undefined });
      setShareSubject(subject);
      setShareBody(body);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "No se pudo preparar el email.");
    } finally {
      setSharePreparing(false);
    }
  }

  function openShareModal() {
    setShareOpen(true);
    void prepareShareDraft();
  }

  function handleShareByEmail(provider: EmailProvider) {
    if (!shareSubject.trim() || !shareBody.trim()) {
      setShareError("Primero prepará el mensaje para enviar.");
      return;
    }

    openEmailComposer(provider, {
      to: shareTo,
      subject: shareSubject,
      body: shareBody,
    });
    setShareOpen(false);
  }

  async function copyShareMessage() {
    const text = [
      shareTo.trim() ? `Para: ${shareTo.trim()}` : "",
      `Asunto: ${shareSubject}`,
      "",
      shareBody,
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  }

  // ── Template editor ──

  function openNewTemplate() {
    setEditingTemplate(null);
    setTplName(""); setTplDesc(""); setTplLabel(""); setTplLogoHeader(false); setTplLogoWatermark(false); setTplHtml("");
    setTplSignaturePosition(DEFAULT_SIGNATURE_POSITION);
    setView("editor");
  }

  function openEditTemplate(tpl: DbContractTemplate) {
    setEditingTemplate(tpl);
    setTplName(tpl.name); setTplDesc(tpl.description); setTplLabel(tpl.label ?? ""); setTplLogoHeader(tpl.logoHeader ?? false); setTplLogoWatermark(tpl.logoWatermark ?? false); setTplHtml(tpl.contentHtml);
    setTplSignaturePosition(tpl.signaturePosition);
    setView("editor");
  }

  async function handleSaveTemplate() {
    const htmlContent = tplHtml.replace(/<[^>]+>/g, "").trim();
    if (!tplName.trim() || !htmlContent) return;
    setSavingTpl(true);
    try {
      if (editingTemplate) {
        const nextMinor = (editingTemplate.versionMinor ?? 0) + 1;
        await updateContractTemplate(editingTemplate.id, {
          name: tplName, description: tplDesc, label: tplLabel,
          logoHeader: tplLogoHeader, logoWatermark: tplLogoWatermark,
          contentHtml: tplHtml, signaturePosition: tplSignaturePosition,
          versionMinor: nextMinor,
        });
        setDbTemplates((prev) => prev.map((t) => t.id === editingTemplate.id
          ? { ...t, name: tplName, description: tplDesc, label: tplLabel, logoHeader: tplLogoHeader, logoWatermark: tplLogoWatermark, contentHtml: tplHtml, signaturePosition: tplSignaturePosition, versionMinor: nextMinor }
          : t));
        showToast("Plantilla actualizada.");
      } else if (orgId) {
        const created = await createContractTemplate({
          orgId,
          name: tplName, description: tplDesc, label: tplLabel,
          logoHeader: tplLogoHeader, logoWatermark: tplLogoWatermark,
          contentHtml: tplHtml, signaturePosition: tplSignaturePosition,
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

      downloadBlob(pdfBlob, signedPdfFileName({
        title: contract.title,
        fileName: contract.fileName,
        sequence: contract.versionNumber,
      }));
      void tryGenerateConsolidatedPdf(contract.id);
    } finally {
      setPreparingPdfId(null);
    }
  }

  const [deletingContract, setDeletingContract] = useState(false);

  async function confirmDeleteContract() {
    if (!deleteTarget) return;
    setDeletingContract(true);
    try {
      await deleteContract(deleteTarget.id);
      setContracts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("Contrato eliminado.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar contrato", "error");
    } finally {
      setDeletingContract(false);
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

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Nombre de la plantilla *</label>
            <input value={tplName} onChange={(e) => setTplName(e.target.value)}
              placeholder="Ej: Contrato de prestación de servicios"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
          </div>
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-zinc-400">Etiqueta (opcional)</label>
            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 focus-within:border-zinc-500 transition">
              <input
                value={tplLabel}
                onChange={(e) => { setTplLabel(e.target.value); setShowLabelSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowLabelSuggestions(false), 150)}
                placeholder="ej: rrhh, inmuebles, pagos"
                className="flex-1 bg-transparent py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none"
                autoComplete="off"
              />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setShowLabelSuggestions((v) => !v); }}
                className="text-zinc-400 hover:text-zinc-600 transition pl-2"
                title="Ver etiquetas existentes"
              >
                <Search size={13} />
              </button>
            </div>
            {showLabelSuggestions && (() => {
              const allLabels = [...new Set(dbTemplates.map((t) => t.label).filter(Boolean))];
              const suggestions = tplLabel
                ? allLabels.filter((l) => l.toLowerCase().includes(tplLabel.toLowerCase()) && l !== tplLabel)
                : allLabels;
              if (suggestions.length === 0) return null;
              return (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setTplLabel(s); setShowLabelSuggestions(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition"
                    >
                      <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{s}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Descripción (opcional)</label>
          <input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)}
            placeholder="Descripción breve del contrato"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition" />
        </div>

        {/* Logo options */}
        <div className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 shrink-0">Logo</p>
          <div className="flex items-center gap-6">
            {([
              { state: tplLogoHeader,    setter: setTplLogoHeader,    label: "Encabezado",   desc: "Logo en la parte superior del documento" },
              { state: tplLogoWatermark, setter: setTplLogoWatermark, label: "Marca de agua", desc: "Logo centrado grande con transparencia de fondo" },
            ] as const).map(({ state, setter, label, desc }) => (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer group" title={desc}>
                <button
                  type="button"
                  onClick={() => setter(!state)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${state ? "bg-emerald-500" : "bg-zinc-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${state ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-xs font-medium text-zinc-600 group-hover:text-zinc-900 transition">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <RichTextEditor
          value={tplHtml}
          onChange={setTplHtml}
          logoHeader={tplLogoHeader}
          logoWatermark={tplLogoWatermark}
          logoUrl={loadOrgCache()?.logoLightUrl ?? loadOrgCache()?.logoDarkUrl ?? null}
          documentTitle={tplName || undefined}
        />

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

        {(() => {
          const allLabels = [...new Set(dbTemplates.map((t) => t.label).filter(Boolean))];
          const visibleLabels = labelSearch
            ? allLabels.filter((l) => l.toLowerCase().includes(labelSearch.toLowerCase()))
            : allLabels;
          const filtered = labelFilter
            ? dbTemplates.filter((t) => t.label === labelFilter)
            : dbTemplates;
          return (
            <>
              {allLabels.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    placeholder="Buscar etiqueta..."
                    className="h-7 w-36 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[11px] text-zinc-700 placeholder:text-zinc-400 outline-none focus:border-zinc-400 transition"
                  />
                  {labelFilter && (
                    <button type="button" onClick={() => setLabelFilter("")}
                      className="h-7 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[11px] text-zinc-500 hover:bg-zinc-100 transition">
                      × Limpiar
                    </button>
                  )}
                  {visibleLabels.map((l) => (
                    <button key={l} type="button" onClick={() => setLabelFilter(l === labelFilter ? "" : l)}
                      className={`h-7 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide transition ${
                        l === labelFilter
                          ? "border-zinc-800 bg-zinc-800 text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
              {loadingTemplates ? (
                <div className="rounded-2xl border border-zinc-100 bg-white divide-y divide-zinc-100 px-2">
                  {Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse my-1 rounded-xl bg-zinc-100" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-zinc-100">
                    <LayoutTemplate size={28} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-700">{labelFilter ? `Sin plantillas con etiqueta "${labelFilter}"` : "Sin plantillas"}</p>
                    <p className="text-sm text-zinc-400 mt-1">{labelFilter ? "Probá con otra etiqueta." : "Creá tu primera plantilla para poder enviar contratos."}</p>
                  </div>
                  {!labelFilter && <Button onClick={openNewTemplate} className="h-10 px-5"><Plus size={14} /> Crear primera plantilla</Button>}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-100 bg-white px-2">
                  {filtered.map((tpl) => (
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
          );
        })()}

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
          orgName={orgName}
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
      {deleteTarget && (
        <DeleteConfirmModal
          contract={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteContract}
          deleting={deletingContract}
        />
      )}
      {sendThirdParty && (
        <SendThirdPartyModal contract={sendThirdParty} onClose={() => setSendThirdParty(null)}
          onSent={(id) => setContracts((prev) => prev.map((x) => x.id === id ? { ...x, status: "SENT", totalSigners: x.totalSigners + 1 } : x))} />
      )}
      {shareOpen && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-6 backdrop-blur-sm">
          <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-7 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Email</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-950">Compartir contratos firmados</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Revisá el destinatario y el mensaje antes de abrir tu correo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-7 py-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden">
              <div className="space-y-3 lg:self-start">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-bold text-zinc-800">
                    {selectedSignedContracts.length} {selectedSignedContracts.length === 1 ? "PDF seleccionado" : "PDFs seleccionados"}
                  </p>
                  <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
                    {selectedSignedContracts.map((contract) => (
                      <div key={contract.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                        <p className="truncate text-xs font-semibold text-zinc-700">
                          {signedPdfFileName({ title: contract.title, fileName: contract.fileName, sequence: contract.versionNumber })}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-400">{contract.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Links seguros</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                    El correo incluye links cortos del portal. Los PDFs no se adjuntan automaticamente.
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Para</label>
                  <input
                    type="text"
                    value={shareTo}
                    onChange={(e) => setShareTo(e.target.value)}
                    placeholder="destinatario@empresa.com"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Asunto</label>
                  <input
                    type="text"
                    value={shareSubject}
                    onChange={(e) => setShareSubject(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Mensaje</label>
                  <textarea
                    value={shareBody}
                    onChange={(e) => setShareBody(e.target.value)}
                    rows={14}
                    className="min-h-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              {shareError && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 lg:col-span-2">
                  {shareError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-100 bg-white px-7 py-4 sm:flex-row sm:items-center">
              <Button disabled={sharePreparing || !shareBody.trim()} onClick={() => handleShareByEmail("gmail")} className="h-10 w-full sm:w-auto sm:px-8">
                <Mail size={14} /> {sharePreparing ? "Preparando..." : "Abrir Gmail"}
              </Button>
              <Button disabled={sharePreparing || !shareBody.trim()} variant="secondary" onClick={() => handleShareByEmail("outlook")} className="h-10 w-full sm:w-auto sm:px-6">
                <Mail size={14} /> Abrir Outlook
              </Button>
              <Button disabled={sharePreparing || !shareBody.trim()} variant="secondary" onClick={() => handleShareByEmail("mailto")} className="h-10 w-full sm:w-auto sm:px-6">
                <Mail size={14} /> Abrir app de correo
              </Button>
              <Button disabled={!shareBody.trim()} variant="ghost" onClick={copyShareMessage} className="h-10 w-full sm:ml-auto sm:w-auto sm:px-5">
                {shareCopied ? "Mensaje copiado" : "Copiar mensaje"}
              </Button>
            </div>
          </div>
        </div>
      ), document.body)}

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
              <div className="rounded-2xl border border-zinc-100 bg-white divide-y divide-zinc-100 px-2">
                {Array(3).fill(null).map((_, i) => <div key={i} className="h-12 animate-pulse my-1 rounded-xl bg-zinc-100" />)}
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
              <div className="rounded-2xl border border-zinc-100 bg-white px-2">
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
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-500">{contracts.filter((c) => c.status !== "DRAFT").length} contratos</p>
              <div className="flex items-center gap-2">
                {visibleSignedContracts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode((v) => {
                        if (v) setSelectedContractIds([]);
                        return !v;
                      });
                    }}
                    title={selectionMode ? "Cancelar selección" : "Seleccionar para enviar por email"}
                    className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                      selectionMode
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-700"
                    }`}
                  >
                    <Check size={14} />
                  </button>
                )}
                {dbTemplates.length > 0 && (
                  <button type="button" onClick={() => setView("templates")}
                    title="Ir a plantillas"
                    className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-700 transition">
                    <LayoutTemplate size={14} />
                  </button>
                )}
                <Button onClick={() => setActiveTab("upload")} className="h-9 px-4 text-xs shrink-0">
                  <Upload size={13} /> Subir PDF
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

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-zinc-200 bg-white space-y-3 p-5">
                  {Array(4).fill(null).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-50" />)}
                </div>
              ) : contractGroups.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center">
                  <Files size={32} className="text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">Sin contratos en este estado</p>
                  <button type="button" onClick={() => setView("templates")}
                    className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-700">
                    Ir a Plantillas para enviar
                  </button>
                </div>
              ) : (
                contractGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  const toggleGroup = () => setExpandedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                    return next;
                  });
                  return (
                    <div key={group.key} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                      {/* Fila del grupo */}
                      <button
                        type="button"
                        onClick={toggleGroup}
                        className="flex w-full items-center justify-between px-5 py-4 hover:bg-zinc-50 transition text-left gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${group.isTemplate ? "bg-blue-50" : "bg-zinc-50"}`}>
                            {group.isTemplate
                              ? <LayoutTemplate size={14} className="text-blue-500" />
                              : <Files size={14} className="text-zinc-500" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {/* Título + etiqueta */}
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-semibold text-zinc-900 truncate text-sm">{group.title}</p>
                              {group.template?.label && (
                                <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                                  {group.template.label}
                                </span>
                              )}
                            </div>
                            {/* Metadata line — igual que TemplateCard */}
                            <p className="text-[11px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              {group.template && (
                                <>
                                  <span>{new Date(group.template.createdAt).toLocaleDateString("es-AR")}</span>
                                  <span className="text-zinc-300">·</span>
                                  <span className="font-semibold text-zinc-500">v1.{group.template.versionMinor ?? 0}</span>
                                </>
                              )}
                              {group.vars.length > 0 && (
                                <>
                                  <span className="text-zinc-300">·</span>
                                  <span>{group.vars.length} variable{group.vars.length !== 1 ? "s" : ""}</span>
                                  {group.orgVars.length > 0 && (
                                    <><span className="text-zinc-300">·</span><span className="text-blue-500">{group.orgVars.length} empresa</span></>
                                  )}
                                  {group.autoVars.length > 0 && (
                                    <><span className="text-zinc-300">·</span><span className="text-emerald-500">{group.autoVars.length} auto</span></>
                                  )}
                                </>
                              )}
                              <span className="text-zinc-300">·</span>
                              <span>{group.contracts.length} {group.contracts.length === 1 ? "envío" : "envíos"}</span>
                              {group.signedCount > 0 && (
                                <><span className="text-zinc-300">·</span>
                                <span className="text-emerald-600 font-semibold">{group.signedCount} firmado{group.signedCount > 1 ? "s" : ""}</span></>
                              )}
                              {group.pendingCount > 0 && (
                                <><span className="text-zinc-300">·</span>
                                <span className="text-amber-600 font-semibold">{group.pendingCount} pendiente{group.pendingCount > 1 ? "s" : ""}</span></>
                              )}
                              {group.rejectedCount > 0 && (
                                <><span className="text-zinc-300">·</span>
                                <span className="text-red-500 font-semibold">{group.rejectedCount} rechazado{group.rejectedCount > 1 ? "s" : ""}</span></>
                              )}
                              {group.template?.description && (
                                <><span className="text-zinc-300">·</span><span>descripción</span></>
                              )}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={16} className={`shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>

                      {/* Envíos individuales */}
                      {isExpanded && (
                        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                          {group.contracts.map((c) => {
                            const { label, className } = statusMeta(c.status);
                            const hasSignedPdf = c.status === "SIGNED" || c.status === "COMPLETED" || c.completedSigners > 0;
                            const isPreparingPdf = preparingPdfId === c.id;
                            const signerName = c.templateFields?.nombre_firmante || c.templateFields?.nombre_usuario || c.templateFields?.nombre || null;
                            const signerEmail = c.templateFields?.email_firmante || c.templateFields?.email_usuario || c.ownerEmail;
                            const dateStr = new Date(c.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
                            const isSelected = selectedContractIds.includes(c.id);
                            return (
                              <div key={c.id}
                                className={`flex items-center gap-3 py-3 pl-16 pr-4 transition group ${isSelected ? "bg-zinc-50" : "hover:bg-zinc-50/60"}`}>
                                {/* Checkbox — solo en modo selección */}
                                {selectionMode && hasSignedPdf && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectedContract(c.id)}
                                    className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900 cursor-pointer"
                                    aria-label={`Seleccionar ${c.title}`}
                                  />
                                )}

                                {/* Info firmante */}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-zinc-800 truncate leading-tight">
                                    {signerName ?? signerEmail}
                                  </p>
                                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                    {signerName ? `${signerEmail} · ` : ""}{dateStr}
                                  </p>
                                </div>

                                {/* Estado */}
                                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>
                                  {label}
                                </span>

                                {/* Acciones — siempre visibles */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Ver auditoría — siempre visible, destacado */}
                                  <button type="button" onClick={() => setViewContract(c)}
                                    title="Ver auditoría"
                                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition">
                                    <Eye size={12} /> Ver
                                  </button>
                                  {/* Descargar PDF firmado */}
                                  {hasSignedPdf && (
                                    <button type="button"
                                      title={isPreparingPdf ? "Preparando PDF..." : "Descargar PDF firmado"}
                                      disabled={isPreparingPdf}
                                      onClick={(e) => { e.stopPropagation(); void openSignedPdf(c); }}
                                      className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-40">
                                      <Download size={13} />
                                    </button>
                                  )}
                                  {/* Enviar al tercero */}
                                  {c.status === "COMPLETED" && (
                                    <button type="button"
                                      title="Enviar al tercero"
                                      onClick={(e) => { e.stopPropagation(); setSendThirdParty(c); }}
                                      className="grid h-7 w-7 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 transition">
                                      <Send size={13} />
                                    </button>
                                  )}
                                  {/* Eliminar */}
                                  <button type="button"
                                    title="Eliminar contrato"
                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                                    className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 hover:bg-red-50 hover:text-red-500 hover:border hover:border-red-200 transition">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Barra flotante de selección */}
            {selectionMode && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-xl shadow-black/10">
                <span className="text-sm font-semibold text-zinc-700">
                  {selectedSignedContracts.length > 0
                    ? `${selectedSignedContracts.length} seleccionado${selectedSignedContracts.length > 1 ? "s" : ""}`
                    : "Seleccioná contratos firmados"}
                </span>
                <div className="h-4 w-px bg-zinc-200" />
                <button type="button" onClick={toggleVisibleSignedContracts}
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition">
                  {allVisibleSignedSelected ? "Quitar todos" : "Seleccionar todos"}
                </button>
                <Button
                  onClick={openShareModal}
                  disabled={selectedSignedContracts.length === 0}
                  className="h-8 px-4 text-xs"
                >
                  <Mail size={13} /> Enviar por email
                </Button>
                <button type="button"
                  onClick={() => { setSelectionMode(false); setSelectedContractIds([]); }}
                  className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
                  <X size={14} />
                </button>
              </div>
            )}
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
