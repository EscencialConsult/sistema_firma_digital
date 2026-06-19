import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Search,
  Send,
  ShieldOff,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../shared/components/ui/Button";
import { getAllUsers, createAdminUser } from "../../shared/services/admin.service";
import type { AdminUserSummary } from "../../shared/types/user";
import {
  CONTRACT_FIELD_DEFS,
  ContractVariables,
  AlumnoData,
  numberToWords,
  formatDateLong,
} from "../../shared/utils/contractTemplate";

// ─── Badge helpers ────────────────────────────────────────────────────────────

function verBadge(status: string) {
  switch (status) {
    case "VERIFIED":  return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "IN_REVIEW": return "text-amber-700 bg-amber-50 border-amber-200";
    case "REJECTED":  return "text-red-700 bg-red-50 border-red-200";
    default:          return "text-zinc-600 bg-zinc-100 border-zinc-200";
  }
}

function verLabel(status: string) {
  const map: Record<string, string> = {
    VERIFIED: "Verificado", PENDING: "Pendiente",
    IN_REVIEW: "En revisión", REJECTED: "Rechazado", EXPIRED: "Expirado",
  };
  return map[status] ?? status;
}

function roleBadge(role: string) {
  return role === "ADMIN"
    ? "text-purple-700 bg-purple-50 border-purple-200"
    : "text-zinc-600 bg-zinc-100 border-zinc-200";
}

function VerIcon({ status }: { status: string }) {
  switch (status) {
    case "VERIFIED":  return <CheckCircle2 size={11} />;
    case "IN_REVIEW": return <Clock3 size={11} />;
    case "REJECTED":  return <XCircle size={11} />;
    default:          return <ShieldOff size={11} />;
  }
}

// ─── Admin field ──────────────────────────────────────────────────────────────

function Field({
  label, value, type = "text", placeholder = "", onChange,
}: {
  label: string; value: string; type?: string; placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-400">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-button)] border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500 transition"
      />
    </div>
  );
}

// ─── Mini contract preview for assign modal ───────────────────────────────────

function MiniContractPreview({ vars, alumno }: {
  vars: Partial<ContractVariables>; alumno: Partial<AlumnoData>;
}) {
  const total  = parseInt(vars.monto_total    ?? "0") || 0;
  const cuota  = parseInt(vars.monto_cuota    ?? "0") || 0;
  const cuotas = parseInt(vars.cantidad_cuotas ?? "0") || 0;
  const juris  = vars.jurisdiccion || "Ciudad Autónoma de Buenos Aires";

  return (
    <div className="overflow-y-auto max-h-[50vh] rounded-xl bg-white text-zinc-900 shadow-inner border border-zinc-200">
      <div className="p-6 font-serif text-[12px] leading-6 space-y-4">
        <div className="text-center border-b border-zinc-200 pb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest">Reconocimiento de Deuda</h2>
          <p className="text-[10px] text-zinc-500">Escencial Consultora S.A.S.</p>
        </div>
        <p className="text-xs text-zinc-500 italic">
          Ciudad de {juris}, República Argentina.
        </p>
        <p>
          <strong>DEUDORA:</strong>{" "}
          <strong className="text-blue-700">{alumno.nombre || "—"}</strong>,
          {" "}D.N.I. N° <strong className="text-blue-700">{alumno.dni || "—"}</strong>,
          {" "}CUIL <strong className="text-blue-700">{alumno.cuil || "—"}</strong>,
          {" "}correo: <strong className="text-blue-700">{alumno.email || "—"}</strong>.
        </p>
        <p>
          <strong>PRIMERA — OBJETO.</strong> Capacitación:{" "}
          <strong className="text-blue-700">«{vars.curso_nombre || "—"}»</strong>.
        </p>
        <p>
          <strong>SEGUNDA — MONTO.</strong> PESOS{" "}
          <strong className="text-blue-700">{numberToWords(total)}</strong>{" "}
          ($ {total.toLocaleString("es-AR")}).
        </p>
        <p>
          <strong>TERCERA — CUOTAS.</strong>{" "}
          <strong className="text-blue-700">{cuotas}</strong> cuotas de ${" "}
          <strong className="text-blue-700">{cuota.toLocaleString("es-AR")}</strong> c/u.
          1ª vencimiento: <strong className="text-blue-700">{formatDateLong(vars.fecha_inicio ?? "")}</strong>.
          Última: <strong className="text-blue-700">{formatDateLong(vars.fecha_vencimiento ?? "")}</strong>.
        </p>
        <p>
          <strong>CUARTA — MORA.</strong> 3% mensual sobre saldo impago ante atraso en cualquier cuota.
        </p>
        <p>
          <strong>QUINTA — FIRMA ELECTRÓNICA.</strong> Válida conforme Ley N° 25.506 con verificación KYC + OTP.
        </p>
        <div className="border-t border-zinc-200 pt-4 grid grid-cols-2 gap-8 text-center">
          <div className="border-t-2 border-zinc-400 pt-2 mt-8">
            <p className="text-[10px] font-bold uppercase">Escencial Consultora</p>
          </div>
          <div className="border-t-2 border-zinc-400 pt-2 mt-8">
            <p className="text-[10px] font-bold uppercase">{alumno.nombre || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Contract Modal ────────────────────────────────────────────────────

function AssignContractModal({
  user,
  onClose,
}: {
  user: AdminUserSummary;
  onClose: () => void;
}) {
  const [step, setStep]   = useState(0);
  const [vars, setVars]   = useState<Partial<ContractVariables>>({
    jurisdiccion: "Ciudad Autónoma de Buenos Aires",
  });
  const [alumno, setAlumno] = useState<Partial<AlumnoData>>({
    nombre: user.fullName,
    email: user.email,
    dni: "",
    cuil: "",
    domicilio: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const varsOk =
    vars.curso_nombre && vars.monto_total && vars.monto_cuota &&
    vars.cantidad_cuotas && vars.fecha_inicio && vars.fecha_vencimiento;
  const alumnoOk = alumno.nombre && alumno.email && alumno.dni;

  async function handleSend() {
    setSending(true);
    // TODO:SUPABASE — create contract + signing_request, email alumno
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="page-transition-enter relative w-full max-w-2xl rounded-[var(--radius-card)] border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <p className="text-xs text-zinc-500">Asignar contrato a</p>
            <p className="font-semibold text-zinc-900">{user.fullName}</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step indicator */}
        {!sent && (
          <div className="flex gap-1 border-b border-zinc-200 px-6 py-3 bg-zinc-50/50">
            {["Contrato", "Datos alumno", "Vista previa"].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  i < step ? "bg-emerald-500 text-white" :
                  i === step ? "bg-zinc-900 text-white" :
                  "bg-zinc-200 text-zinc-500"
                }`}>
                  {i < step ? <Check size={9} /> : i + 1}
                </span>
                <span className={`text-xs ${i === step ? "text-zinc-900 font-medium" : "text-zinc-500"}`}>{s}</span>
                {i < 2 && <ChevronRight size={11} className="text-zinc-300 ml-1" />}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 border border-emerald-200">
                <Check size={28} className="text-emerald-600" />
              </div>
              <p className="font-bold text-zinc-900">¡Contrato enviado!</p>
              <p className="mt-1 text-sm text-zinc-500">
                Se notificó a <strong className="text-zinc-800">{user.email}</strong> para firmar.
              </p>
              <Button onClick={onClose} className="mt-6 h-9 px-5">Cerrar</Button>
            </div>
          ) : (
            <>
              {/* Step 0: contract vars */}
              {step === 0 && (
                <div className="space-y-4">
                  <Field label="Nombre del curso" value={vars.curso_nombre ?? ""} placeholder="Ej: Liquidación de Sueldos" onChange={(v) => setVars((p) => ({ ...p, curso_nombre: v }))} />
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Monto total ($)" type="number" value={vars.monto_total ?? ""} placeholder="150000" onChange={(v) => setVars((p) => ({ ...p, monto_total: v }))} />
                    <Field label="Monto cuota ($)" type="number" value={vars.monto_cuota ?? ""} placeholder="25000" onChange={(v) => setVars((p) => ({ ...p, monto_cuota: v }))} />
                    <Field label="Cant. cuotas" type="number" value={vars.cantidad_cuotas ?? ""} placeholder="6" onChange={(v) => setVars((p) => ({ ...p, cantidad_cuotas: v }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Venc. 1ª cuota" type="date" value={vars.fecha_inicio ?? ""} onChange={(v) => setVars((p) => ({ ...p, fecha_inicio: v }))} />
                    <Field label="Venc. última cuota" type="date" value={vars.fecha_vencimiento ?? ""} onChange={(v) => setVars((p) => ({ ...p, fecha_vencimiento: v }))} />
                  </div>
                  <Field label="Jurisdicción" value={vars.jurisdiccion ?? ""} onChange={(v) => setVars((p) => ({ ...p, jurisdiccion: v }))} />
                  <div className="flex justify-end pt-1">
                    <Button onClick={() => setStep(1)} disabled={!varsOk} className="h-9 px-5">
                      Continuar <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 1: alumno data */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700">
                      {user.fullName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{user.fullName}</p>
                      <p className="text-xs text-zinc-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombre completo" value={alumno.nombre ?? ""} onChange={(v) => setAlumno((a) => ({ ...a, nombre: v }))} />
                    <Field label="Email" value={alumno.email ?? ""} onChange={(v) => setAlumno((a) => ({ ...a, email: v }))} />
                    <Field label="DNI *" value={alumno.dni ?? ""} placeholder="40123456" onChange={(v) => setAlumno((a) => ({ ...a, dni: v }))} />
                    <Field label="CUIL/CUIT" value={alumno.cuil ?? ""} placeholder="20-40123456-7" onChange={(v) => setAlumno((a) => ({ ...a, cuil: v }))} />
                  </div>
                  <Field label="Domicilio (opcional)" value={alumno.domicilio ?? ""} placeholder="Av. Corrientes 1234, CABA" onChange={(v) => setAlumno((a) => ({ ...a, domicilio: v }))} />
                  <div className="flex justify-between pt-1">
                    <Button variant="secondary" onClick={() => setStep(0)} className="h-9 px-4 text-zinc-700">
                      <ArrowLeft size={13} /> Atrás
                    </Button>
                    <Button onClick={() => setStep(2)} disabled={!alumnoOk} className="h-9 px-5">
                      Ver contrato <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: preview */}
              {step === 2 && (
                <div className="space-y-4">
                  <MiniContractPreview vars={vars} alumno={alumno} />
                  <div className="flex justify-between">
                    <Button variant="secondary" onClick={() => setStep(1)} className="h-9 px-4 text-zinc-700">
                      <ArrowLeft size={13} /> Atrás
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={sending}
                      className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {sending ? "Enviando..." : <><Send size={13} /> Enviar contrato</>}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/['"]/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/['"]/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MainTab  = "list" | "add" | "import";
type Filter   = "all" | "admin" | "verified" | "in_review" | "pending" | "rejected";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",       label: "Todos" },
  { key: "admin",     label: "Admins" },
  { key: "verified",  label: "Verificados" },
  { key: "in_review", label: "En revisión" },
  { key: "pending",   label: "Pendientes" },
  { key: "rejected",  label: "Rechazados" },
];

export function AdminUsersPage() {
  const [users, setUsers]         = useState<AdminUserSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<MainTab>("list");
  const [filter, setFilter]       = useState<Filter>("all");
  const [search, setSearch]       = useState("");
  const [assignUser, setAssignUser] = useState<AdminUserSummary | null>(null);

  // ── Add form ──
  const [addForm, setAddForm] = useState({ fullName: "", email: "", password: "", role: "USER" as "USER" | "ADMIN" });
  const [addError, setAddError]   = useState("");
  const [addSuccess, setAddSuccess] = useState(false);

  // ── CSV import ──
  const csvRef                    = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows]     = useState<Record<string, string>[]>([]);
  const [csvDrag, setCsvDrag]     = useState(false);
  const [csvImported, setCsvImported] = useState(false);

  useEffect(() => {
    getAllUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  // ── Filtered users ──
  const filtered = useMemo(() => {
    let list = users;
    if (filter === "admin")     list = list.filter((u) => u.role === "ADMIN");
    else if (filter !== "all") {
      const statusMap: Record<Exclude<Filter, "all" | "admin">, string> = {
        verified: "VERIFIED", in_review: "IN_REVIEW", pending: "PENDING", rejected: "REJECTED",
      };
      list = list.filter((u) => u.verificationStatus === statusMap[filter as Exclude<Filter, "all" | "admin">]);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, filter, search]);

  // ── Add user ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!addForm.fullName || !addForm.email || !addForm.password) {
      setAddError("Todos los campos son obligatorios.");
      return;
    }
    if (addForm.password.length < 6) {
      setAddError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    try {
      const newUser = await createAdminUser({
        fullName: addForm.fullName,
        email:    addForm.email,
        password: addForm.password,
        role:     addForm.role,
      });
      setUsers((prev) => [newUser, ...prev]);
      setAddSuccess(true);
      setAddForm({ fullName: "", email: "", password: "", role: "USER" });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Error al crear el usuario");
    }
  }

  // ── CSV processing ──
  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvRows(parseCsv(text));
      setCsvImported(false);
    };
    reader.readAsText(file);
  }

  function handleCsvDrop(e: React.DragEvent) {
    e.preventDefault();
    setCsvDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCsvFile(file);
  }

  function handleCsvImport() {
    // TODO:SUPABASE — batch insert users
    const newUsers: AdminUserSummary[] = csvRows.map((row, i) => ({
      id: `u-csv-${Date.now()}-${i}`,
      email: row.email || row.correo || "",
      fullName: row.nombre_completo || row.nombre || `${row.nombre ?? ""} ${row.apellido ?? ""}`.trim(),
      role: (row.rol?.toUpperCase() === "ADMIN" ? "ADMIN" : "USER") as "USER" | "ADMIN",
      verificationStatus: "PENDING",
      certificateStatus: "NONE",
      createdAt: new Date().toISOString(),
    }));
    setUsers((prev) => [...newUsers, ...prev]);
    setCsvImported(true);
  }

  // ── Tab bar ──
  const tabConfig: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "list",   label: "Usuarios",  icon: <Users size={14} /> },
    { key: "add",    label: "Agregar",   icon: <UserPlus size={14} /> },
    { key: "import", label: "Importar",  icon: <Upload size={14} /> },
  ];

  return (
    <>
      {/* Assign modal */}
      {assignUser && (
        <AssignContractModal user={assignUser} onClose={() => setAssignUser(null)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Usuarios</h1>
          <p className="mt-1 text-sm text-zinc-500">Gestión completa de usuarios del sistema.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-[var(--radius-button)] border border-zinc-200 bg-white p-1">
          {tabConfig.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              type="button"
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-zinc-100 text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Lista ── */}
        {tab === "list" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2.5 rounded-[var(--radius-button)] border border-zinc-200 bg-white px-3.5 py-2.5 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-100 transition">
              <Search size={15} className="shrink-0 text-zinc-400" />
              <input
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} type="button" className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  type="button"
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    filter === key
                      ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                  {key !== "all" && (
                    <span className="ml-1.5 text-zinc-600">
                      {users.filter((u) => {
                        if (key === "admin") return u.role === "ADMIN";
                        const m: Record<string, string> = { verified:"VERIFIED", in_review:"IN_REVIEW", pending:"PENDING", rejected:"REJECTED" };
                        return u.verificationStatus === m[key];
                      }).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* User list */}
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-zinc-200 bg-white">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 bg-zinc-50/50">
                <Users size={14} className="text-zinc-500" />
                <p className="text-xs font-semibold text-zinc-500">
                  {loading ? "Cargando..." : `${filtered.length} usuario${filtered.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              {loading ? (
                <div className="space-y-3 p-5">
                  {Array(4).fill(null).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-14 text-center">
                  <Users size={30} className="text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">Sin resultados</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filtered.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-col gap-2 px-5 py-4 hover:bg-zinc-50/50 transition sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600">
                          {u.fullName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 truncate">{u.fullName}</p>
                          <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${verBadge(u.verificationStatus)}`}>
                          <VerIcon status={u.verificationStatus} />
                          {verLabel(u.verificationStatus)}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleBadge(u.role)}`}>
                          {u.role}
                        </span>
                        {u.verificationStatus === "VERIFIED" && (
                          <button
                            type="button"
                            onClick={() => setAssignUser(u)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 transition"
                          >
                            <FileText size={11} /> Asignar contrato
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Agregar usuario ── */}
        {tab === "add" && (
          <div className="max-w-md space-y-5">
            <p className="text-sm text-zinc-400">
              Agregá un usuario manualmente. Recibirá sus credenciales por email.
            </p>

            {addSuccess ? (
              <div className="rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 p-6 text-center">
                <Check size={28} className="text-emerald-600 mx-auto mb-3" />
                <p className="font-semibold text-emerald-900">Usuario agregado</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Quedó registrado como pendiente de verificación KYC.
                </p>
                <Button
                  onClick={() => setAddSuccess(false)}
                  className="mt-4 h-9 px-5"
                >
                  Agregar otro
                </Button>
              </div>
            ) : (
              <form onSubmit={handleAdd} className="space-y-4">
                <Field
                  label="Nombre completo"
                  value={addForm.fullName}
                  placeholder="María González"
                  onChange={(v) => setAddForm((f) => ({ ...f, fullName: v }))}
                />
                <Field
                  label="Email"
                  type="email"
                  value={addForm.email}
                  placeholder="maria@empresa.com"
                  onChange={(v) => setAddForm((f) => ({ ...f, email: v }))}
                />
                <Field
                  label="Contraseña temporal"
                  type="password"
                  value={addForm.password}
                  placeholder="Mínimo 6 caracteres"
                  onChange={(v) => setAddForm((f) => ({ ...f, password: v }))}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500">Rol</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as "USER" | "ADMIN" }))}
                    className="w-full rounded-[var(--radius-button)] border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 transition"
                  >
                    <option value="USER">Alumno / Usuario</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                {addError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                    {addError}
                  </p>
                )}

                <Button type="submit" className="w-full h-10">
                  <UserPlus size={14} /> Crear usuario
                </Button>
              </form>
            )}
          </div>
        )}

        {/* ── Tab: Importar CSV ── */}
        {tab === "import" && (
          <div className="space-y-5">
            <div className="rounded-[var(--radius-card)] border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold text-zinc-500 mb-1">Formato esperado (primera fila = encabezados):</p>
              <code className="block rounded-lg bg-zinc-100 px-4 py-3 text-[11px] font-mono text-zinc-600">
                nombre_completo,email,rol,dni,empresa
                <br />
                María González,maria@gmail.com,USER,40123456,Empresa SA
                <br />
                Juan Pérez,juan@empresa.com,USER,38765432,Consultora XYZ
              </code>
            </div>

            {/* Drop zone */}
            {csvRows.length === 0 && (
              <div
                onDrop={handleCsvDrop}
                onDragOver={(e) => { e.preventDefault(); setCsvDrag(true); }}
                onDragLeave={() => setCsvDrag(false)}
                onClick={() => csvRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed cursor-pointer py-14 transition ${
                  csvDrag
                    ? "border-zinc-400 bg-zinc-50"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                }`}
              >
                <Upload size={28} className="text-zinc-400" />
                <p className="text-sm font-medium text-zinc-600">Arrastrá un archivo CSV o hacé click para seleccionar</p>
                <p className="text-xs text-zinc-400">.csv · UTF-8</p>
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
                />
              </div>
            )}

            {/* Preview */}
            {csvRows.length > 0 && !csvImported && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">
                    <strong className="text-zinc-900">{csvRows.length}</strong> registros encontrados
                  </p>
                  <button
                    type="button"
                    onClick={() => setCsvRows([])}
                    className="text-xs text-zinc-500 hover:text-zinc-700 underline"
                  >
                    Cambiar archivo
                  </button>
                </div>

                <div className="overflow-x-auto rounded-[var(--radius-card)] border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        {Object.keys(csvRows[0]).map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {csvRows.slice(0, 8).map((row, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-4 py-3 text-zinc-700">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 8 && (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
                      + {csvRows.length - 8} filas más
                    </div>
                  )}
                </div>

                <Button onClick={handleCsvImport} className="h-10 px-6">
                  <Upload size={14} /> Importar {csvRows.length} usuarios
                </Button>
              </div>
            )}

            {/* Success */}
            {csvImported && (
              <div className="rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 p-6 text-center">
                <Check size={28} className="text-emerald-600 mx-auto mb-3" />
                <p className="font-semibold text-emerald-900">{csvRows.length} usuarios importados</p>
                <p className="mt-1 text-sm text-emerald-700">
                  Aparecen en la lista con estado "Pendiente" — deberán completar el KYC.
                </p>
                <div className="flex justify-center gap-3 mt-4">
                  <Button onClick={() => { setCsvRows([]); setCsvImported(false); }} variant="secondary" className="h-9 px-4 text-zinc-700">
                    Importar otro
                  </Button>
                  <Button onClick={() => setTab("list")} className="h-9 px-4">
                    Ver lista
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
