import { Check, Copy, Pencil, Plus, Trash2, DollarSign, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../shared/components/ui/Button";
import { Input } from "../../shared/components/ui/Input";
import { Toast } from "../../shared/components/ui/Toast";
import {
  getPaymentTemplates,
  createPaymentTemplate,
  updatePaymentTemplate,
  deletePaymentTemplate,
  computeInstallmentAmount,
  FREQUENCY_LABELS,
  type PaymentTemplate,
} from "../../shared/services/paymentTemplates.service";

// ─── CopyBtn ─────────────────────────────────────────────────────────────────

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

// ─── Create / Edit Modal ─────────────────────────────────────────────────────

function TemplateFormModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: PaymentTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName]             = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [totalAmount, setTotalAmount] = useState(String(existing?.totalAmount ?? ""));
  const [installmentCount, setInstallmentCount] = useState(String(existing?.installmentCount ?? ""));
  const [frequency, setFrequency]  = useState(existing?.frequency ?? "monthly");
  const [hasMora, setHasMora]       = useState(existing?.hasMora ?? true);
  const [moraRate, setMoraRate]     = useState(String(existing?.moraRate ?? 3));
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const total  = Number(totalAmount) || 0;
  const count  = Number(installmentCount) || 1;
  const per    = computeInstallmentAmount(total, count);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !total || !count) { setError("Completá nombre, monto total y cantidad de cuotas."); return; }
    setSaving(true);
    setError("");
    try {
      if (existing) {
        await updatePaymentTemplate(existing.id, {
          name:             name.trim(),
          description:      description.trim() || null,
          totalAmount:      total,
          installmentCount: count,
          frequency,
          hasMora,
          moraRate:         Number(moraRate) || 3,
        });
      } else {
        await createPaymentTemplate({
          name:             name.trim(),
          description:      description.trim() || undefined,
          totalAmount:      total,
          installmentCount: count,
          frequency,
          hasMora,
          moraRate:         Number(moraRate) || 3,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando plantilla");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-zinc-200 p-6 space-y-5"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{existing ? "Editar plantilla" : "Nueva plantilla de pago"}</h2>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-800 transition">Cerrar</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Plan de capacitación" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10" placeholder="Descripción opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Monto total (ARS) *</label>
              <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="180000" min={0} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Cantidad de cuotas *</label>
              <Input type="number" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} placeholder="6" min={1} />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
            <DollarSign size={15} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-600">Cuota estimada:</span>
            <span className="text-sm font-bold text-zinc-900">${per.toLocaleString("es-AR")}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Frecuencia</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Tasa de mora (%)</label>
              <Input type="number" value={moraRate} onChange={(e) => setMoraRate(e.target.value)} min={0} max={100} step={0.5} disabled={!hasMora} />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hasMora} onChange={(e) => setHasMora(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/10" />
            <span className="text-sm text-zinc-700">Aplicar mora por atraso</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-9 px-4 text-sm">Cancelar</Button>
            <Button type="submit" disabled={saving} className="h-9 px-5 text-sm">
              {saving ? "Guardando…" : existing ? "Actualizar" : "Crear plantilla"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function AdminPaymentTemplatesTab() {
  const [templates, setTemplates] = useState<PaymentTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState<PaymentTemplate | null>(null);
  const [toast, setToast]         = useState<{ type: "success" | "error"; message: string; visible: boolean } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await getPaymentTemplates();
      setTemplates(data);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Error cargando plantillas", visible: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [templates, search]);

  async function handleDelete(t: PaymentTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      await deletePaymentTemplate(t.id);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      setToast({ type: "success", message: "Plantilla eliminada", visible: true });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Error eliminando", visible: true });
    }
  }

  return (
    <>
      {toast && <Toast type={toast.type} message={toast.message} visible={toast.visible} onClose={() => setToast(null)} />}
      {showForm && <TemplateFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
      {editItem && <TemplateFormModal existing={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); reload(); }} />}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative max-w-xs flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plantillas…" className="h-9 text-sm" />
          </div>
          <Button onClick={() => setShowForm(true)} className="h-9 px-4 text-sm shrink-0">
            <Plus size={14} className="mr-1.5" /> Nueva plantilla
          </Button>
        </div>

        {loading && <p className="text-sm text-zinc-400 py-8 text-center">Cargando plantillas…</p>}

        {!loading && filtered.length === 0 && (
          <div className="grid place-items-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 py-12">
            <DollarSign size={32} className="text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500 font-medium">No hay plantillas de pago</p>
            <p className="text-xs text-zinc-400 mt-1">Creá la primera para empezar a asignar cuotas.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">Nombre</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">Monto total</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-zinc-500">Cuotas</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">Valor cuota</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-zinc-500">Frecuencia</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-zinc-500">Mora</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{t.name}</p>
                      {t.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">${t.totalAmount.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-center text-zinc-700">{t.installmentCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">${(t.installmentAmount ?? computeInstallmentAmount(t.totalAmount, t.installmentCount)).toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-center text-zinc-600 text-xs">{FREQUENCY_LABELS[t.frequency] ?? t.frequency}</td>
                    <td className="px-4 py-3 text-center">
                      {t.hasMora
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">{t.moraRate}%</span>
                        : <span className="text-xs text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditItem(t)} title="Editar"
                          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(t)} title="Eliminar"
                          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
