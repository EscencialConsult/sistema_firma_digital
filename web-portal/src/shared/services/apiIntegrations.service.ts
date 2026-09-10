import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiCredentialStatus = "ACTIVE" | "REVOKED";

export interface ApiCredential {
  id:           string;
  keyId:        string;
  secretLast4:  string;
  status:       ApiCredentialStatus;
  createdAt:    string;
  lastUsedAt:   string | null;
  revokedAt:    string | null;
}

export interface ApiTemplateBinding {
  id:                    string;
  organizationId:        string;
  contractTemplateId:    string;
  contractTemplateName:  string;
  apiSlug:               string;
  isEnabled:             boolean;
  enabledBy:             string | null;
  createdAt:             string;
}

export type WebhookEventStatus = "PENDING" | "DELIVERED" | "FAILED" | "DEAD";

export interface WebhookEvent {
  id:                  string;
  organizationId:      string;
  eventType:           string;
  documentId:          string | null;
  signatureRequestId:  string | null;
  payload:             unknown;
  status:              WebhookEventStatus;
  attempts:            number;
  maxAttempts:         number;
  nextAttemptAt:       string | null;
  lastError:           string | null;
  deliveredAt:         string | null;
  createdAt:           string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapCredentialRow(r: Record<string, unknown>): ApiCredential {
  return {
    id:           r.id as string,
    keyId:        r.key_id as string,
    secretLast4:  r.secret_last4 as string,
    status:       r.status as ApiCredentialStatus,
    createdAt:    r.created_at as string,
    lastUsedAt:   (r.last_used_at as string) ?? null,
    revokedAt:    (r.revoked_at as string) ?? null,
  };
}

function mapBindingRow(r: Record<string, unknown>): ApiTemplateBinding {
  const template = r.contract_templates as Record<string, unknown> | null;
  return {
    id:                   r.id as string,
    organizationId:       r.organization_id as string,
    contractTemplateId:   r.contract_template_id as string,
    contractTemplateName: (template?.name as string) ?? "",
    apiSlug:              (r.api_slug as string) ?? "",
    isEnabled:            (r.is_enabled as boolean) ?? false,
    enabledBy:            (r.enabled_by as string) ?? null,
    createdAt:            r.created_at as string,
  };
}

function mapWebhookEventRow(r: Record<string, unknown>): WebhookEvent {
  return {
    id:                  r.id as string,
    organizationId:      r.organization_id as string,
    eventType:           r.event_type as string,
    documentId:          (r.document_id as string) ?? null,
    signatureRequestId:  (r.signature_request_id as string) ?? null,
    payload:             r.payload,
    status:              r.status as WebhookEventStatus,
    attempts:            (r.attempts as number) ?? 0,
    maxAttempts:         (r.max_attempts as number) ?? 0,
    nextAttemptAt:       (r.next_attempt_at as string) ?? null,
    lastError:           (r.last_error as string) ?? null,
    deliveredAt:         (r.delivered_at as string) ?? null,
    createdAt:           r.created_at as string,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getApiCredentials(orgId: string): Promise<ApiCredential[]> {
  const { data, error } = await supabase
    .from("api_credentials")
    .select("id, key_id, secret_last4, status, created_at, last_used_at, revoked_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCredentialRow(r as Record<string, unknown>));
}

export async function getApiTemplateBindings(orgId: string): Promise<ApiTemplateBinding[]> {
  const { data, error } = await supabase
    .from("api_template_bindings")
    .select("*, contract_templates(name)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapBindingRow(r as Record<string, unknown>));
}

export async function getWebhookEvents(orgId: string, limit = 20): Promise<WebhookEvent[]> {
  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapWebhookEventRow(r as Record<string, unknown>));
}

// ─── Writes (directas a la tabla) ────────────────────────────────────────────

/**
 * Crea o actualiza el binding de una plantilla al slug de API.
 * Busca primero por organization_id + contract_template_id: si existe, actualiza;
 * si no, hace upsert (por si dos requests concurrentes chocan en el mismo api_slug).
 */
export async function setApiTemplateBinding(
  orgId: string,
  templateId: string,
  apiSlug: string,
  isEnabled: boolean
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("api_template_bindings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contract_template_id", templateId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing) {
    const { error } = await supabase
      .from("api_template_bindings")
      .update({ api_slug: apiSlug, is_enabled: isEnabled })
      .eq("id", existing.id as string);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("api_template_bindings")
    .upsert(
      {
        organization_id:      orgId,
        contract_template_id: templateId,
        api_slug:             apiSlug,
        is_enabled:            isEnabled,
        enabled_by:            user?.id ?? null,
      },
      { onConflict: "organization_id,api_slug" }
    );
  if (error) throw new Error(error.message);
}

// ─── Writes (via Edge Function admin-api-credentials) ────────────────────────

async function invokeAdminApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api-credentials", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error as string);
  return data as T;
}

export async function enableApiForOrg(orgId: string): Promise<void> {
  await invokeAdminApi<{ ok: boolean }>({ action: "enable", organizationId: orgId });
}

export async function disableApiForOrg(orgId: string): Promise<void> {
  await invokeAdminApi<{ ok: boolean }>({ action: "disable", organizationId: orgId });
}

/** El secret se devuelve UNA sola vez — no queda recuperable después. */
export async function generateApiCredential(orgId: string): Promise<{ keyId: string; secret: string }> {
  return invokeAdminApi<{ keyId: string; secret: string }>({
    action: "generate_credential",
    organizationId: orgId,
  });
}

export async function revokeApiCredential(credentialId: string): Promise<void> {
  await invokeAdminApi<{ ok: boolean }>({ action: "revoke_credential", credentialId });
}

/** El webhookSecret (HMAC) se devuelve UNA sola vez — no queda recuperable después. */
export async function setOrgWebhook(orgId: string, webhookUrl: string): Promise<{ webhookSecret: string }> {
  return invokeAdminApi<{ webhookSecret: string }>({
    action: "set_webhook",
    organizationId: orgId,
    webhookUrl,
  });
}
