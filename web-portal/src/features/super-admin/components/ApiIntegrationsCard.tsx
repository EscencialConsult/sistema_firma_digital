import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Key,
  Loader2,
  Plug,
  Plus,
  Save,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { getOrganization } from "../../../shared/services/organizations.service";
import { getContractTemplates, type DbContractTemplate } from "../../../shared/services/contractTemplates.service";
import {
  disableApiForOrg,
  enableApiForOrg,
  generateApiCredential,
  getApiCredentials,
  getApiTemplateBindings,
  getWebhookEvents,
  revokeApiCredential,
  setApiTemplateBinding,
  setOrgWebhook,
  type ApiCredential,
  type ApiTemplateBinding,
  type WebhookEvent,
} from "../../../shared/services/apiIntegrations.service";
import { ApiCredentialModal } from "./ApiCredentialModal";

interface ApiIntegrationsCardProps {
  organizationId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const EVENT_STATUS_STYLE: Record<WebhookEvent["status"], string> = {
  PENDING:   "text-amber-400",
  DELIVERED: "text-emerald-400",
  FAILED:    "text-red-400",
  DEAD:      "text-zinc-500",
};

export function ApiIntegrationsCard({ organizationId }: ApiIntegrationsCardProps) {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [isApiEnabled, setIsApiEnabled] = useState(false);
  const [toggling, setToggling]         = useState(false);

  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [generating, setGenerating]   = useState(false);
  const [revokingId, setRevokingId]   = useState<string | null>(null);

  const [templates, setTemplates] = useState<DbContractTemplate[]>([]);
  const [bindings, setBindings]   = useState<ApiTemplateBinding[]>([]);
  const [slugDrafts, setSlugDrafts] = useState<Record<string, string>>({});
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl]       = useState("");
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);

  const [modalOpen, setModalOpen]   = useState(false);
  const [modalLabel, setModalLabel] = useState("");
  const [modalValue, setModalValue] = useState("");

  async function loadEnabledData() {
    const [creds, tpls, binds, events] = await Promise.all([
      getApiCredentials(organizationId),
      getContractTemplates(organizationId),
      getApiTemplateBindings(organizationId),
      getWebhookEvents(organizationId, 20),
    ]);
    setCredentials(creds);
    setTemplates(tpls);
    setBindings(binds);
    setWebhookEvents(events);
    setSlugDrafts((prev) => {
      const next = { ...prev };
      for (const b of binds) if (next[b.contractTemplateId] === undefined) next[b.contractTemplateId] = b.apiSlug;
      return next;
    });
  }

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOrganization(organizationId)
      .then(async (org) => {
        if (cancelled || !org) return;
        setIsApiEnabled(!!org.isApiEnabled);
        setWebhookUrl(org.apiWebhookUrl ?? "");
        if (org.isApiEnabled) await loadEnabledData();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar la integración API"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function toggleApi() {
    setToggling(true);
    setError(null);
    try {
      if (isApiEnabled) {
        await disableApiForOrg(organizationId);
        setIsApiEnabled(false);
      } else {
        await enableApiForOrg(organizationId);
        setIsApiEnabled(true);
        await loadEnabledData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar el estado de la API");
    } finally {
      setToggling(false);
    }
  }

  async function handleGenerateCredential() {
    setGenerating(true);
    setError(null);
    try {
      const { keyId, secret } = await generateApiCredential(organizationId);
      setModalLabel(`Credencial generada — ${keyId}`);
      setModalValue(secret);
      setModalOpen(true);
      setCredentials(await getApiCredentials(organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar la credencial");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevokeCredential(id: string) {
    if (!window.confirm("¿Revocar esta credencial? Dejará de funcionar de inmediato.")) return;
    setRevokingId(id);
    setError(null);
    try {
      await revokeApiCredential(id);
      setCredentials(await getApiCredentials(organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al revocar la credencial");
    } finally {
      setRevokingId(null);
    }
  }

  function bindingFor(templateId: string): ApiTemplateBinding | undefined {
    return bindings.find((b) => b.contractTemplateId === templateId);
  }

  async function handleSaveBinding(templateId: string) {
    const apiSlug = (slugDrafts[templateId] ?? "").trim();
    if (!apiSlug) return;
    const existing = bindingFor(templateId);
    setSavingTemplateId(templateId);
    setError(null);
    try {
      await setApiTemplateBinding(organizationId, templateId, apiSlug, existing?.isEnabled ?? true);
      setBindings(await getApiTemplateBindings(organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la plantilla");
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function handleToggleBinding(templateId: string) {
    const existing = bindingFor(templateId);
    const apiSlug = (slugDrafts[templateId] ?? existing?.apiSlug ?? "").trim();
    if (!apiSlug || !existing) return;
    setSavingTemplateId(templateId);
    setError(null);
    try {
      await setApiTemplateBinding(organizationId, templateId, apiSlug, !existing.isEnabled);
      setBindings(await getApiTemplateBindings(organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la plantilla");
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function handleSaveWebhook() {
    setWebhookSaving(true);
    setError(null);
    try {
      const { webhookSecret } = await setOrgWebhook(organizationId, webhookUrl.trim());
      setModalLabel("Secreto del webhook generado");
      setModalValue(webhookSecret);
      setModalOpen(true);
      setWebhookEvents(await getWebhookEvents(organizationId, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el webhook");
    } finally {
      setWebhookSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="grid place-items-center py-6">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Plug size={14} className={isApiEnabled ? "text-emerald-400" : "text-zinc-500"} />
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">API / Integraciones</p>
        </div>
        <div className="flex items-center gap-3">
          {isApiEnabled ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
              <CheckCircle size={12} /> Habilitada
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-zinc-500">
              <XCircle size={12} /> Deshabilitada
            </span>
          )}
          <button
            type="button"
            onClick={toggleApi}
            disabled={toggling}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
              isApiEnabled
                ? "border-red-800 text-red-400 hover:bg-red-950/40"
                : "border-emerald-800 text-emerald-400 hover:bg-emerald-950/40"
            }`}
          >
            {toggling ? <Loader2 size={13} className="animate-spin" /> : isApiEnabled ? "Deshabilitar" : "Habilitar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {isApiEnabled && (
        <div className="space-y-6">
          {/* Credenciales */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <Key size={12} /> Credenciales de API
              </p>
              <button
                type="button"
                onClick={handleGenerateCredential}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Generar credenciales
              </button>
            </div>

            {credentials.length === 0 ? (
              <p className="text-xs text-zinc-600">Todavía no hay credenciales generadas.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-800/50 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Key ID</th>
                      <th className="px-3 py-2 font-medium">Creada</th>
                      <th className="px-3 py-2 font-medium">Último uso</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {credentials.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono text-zinc-300">{c.keyId}</td>
                        <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{formatDate(c.lastUsedAt)}</td>
                        <td className="px-3 py-2">
                          {c.status === "ACTIVE" ? (
                            <span className="text-emerald-400">Activa</span>
                          ) : (
                            <span className="text-zinc-500">Revocada</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.status === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() => handleRevokeCredential(c.id)}
                              disabled={revokingId === c.id}
                              className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition disabled:opacity-40"
                            >
                              {revokingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              Revocar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Plantillas habilitadas para API */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Plantillas habilitadas para API
            </p>
            {templates.length === 0 ? (
              <p className="text-xs text-zinc-600">Esta organización todavía no tiene plantillas de contrato.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => {
                  const binding = bindingFor(tpl.id);
                  return (
                    <div
                      key={tpl.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-800/30 px-3 py-2.5"
                    >
                      <p className="min-w-0 flex-1 truncate text-xs text-zinc-300">{tpl.name}</p>
                      <input
                        type="text"
                        value={slugDrafts[tpl.id] ?? ""}
                        onChange={(e) => setSlugDrafts((prev) => ({ ...prev, [tpl.id]: e.target.value }))}
                        placeholder="api_slug"
                        className="w-40 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-mono text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveBinding(tpl.id)}
                        disabled={savingTemplateId === tpl.id || !(slugDrafts[tpl.id] ?? "").trim()}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
                      >
                        {savingTemplateId === tpl.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBinding(tpl.id)}
                        disabled={savingTemplateId === tpl.id || !binding}
                        title={!binding ? "Guardá un api_slug primero" : undefined}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-30 ${
                          binding?.isEnabled
                            ? "border-emerald-800 text-emerald-400 hover:bg-emerald-950/40"
                            : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        {binding?.isEnabled ? "Habilitada" : "Deshabilitada"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Webhook saliente */}
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <Webhook size={12} /> Webhook saliente
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://tu-sistema.com/webhooks/firma-digital"
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveWebhook}
                disabled={webhookSaving || !webhookUrl.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100 transition disabled:opacity-40"
              >
                {webhookSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar / regenerar secreto
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Al guardar se regenera el secreto HMAC usado para firmar los eventos — se muestra una única vez.
            </p>

            {webhookEvents.length === 0 ? (
              <p className="text-xs text-zinc-600">Todavía no se registraron eventos de webhook.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-800/50 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Evento</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Intentos</th>
                      <th className="px-3 py-2 font-medium">Creado</th>
                      <th className="px-3 py-2 font-medium">Último error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {webhookEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="px-3 py-2 font-mono text-zinc-300 whitespace-nowrap">{ev.eventType}</td>
                        <td className={`px-3 py-2 font-medium ${EVENT_STATUS_STYLE[ev.status]}`}>{ev.status}</td>
                        <td className="px-3 py-2 text-zinc-400">{ev.attempts}/{ev.maxAttempts}</td>
                        <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{formatDate(ev.createdAt)}</td>
                        <td className="px-3 py-2 text-zinc-500">
                          {ev.lastError ? (
                            <span className="flex items-center gap-1 text-red-400">
                              <AlertTriangle size={11} className="shrink-0" /> {ev.lastError}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ApiCredentialModal
        open={modalOpen}
        label={modalLabel}
        value={modalValue}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
