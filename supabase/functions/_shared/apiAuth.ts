/**
 * Autenticación de la API B2B — módulo compartido por las funciones api-*.
 *
 * Inbound (empresa → nuestra API): Bearer token simple. El secret nace de alta
 * entropía (256 bits random, generado en admin-api-credentials), así que un hash
 * determinístico indexado (sha256) alcanza para lookup O(1) — mismo patrón que
 * usan Stripe/GitHub para tokens de API (distinto del caso de passwords, que sí
 * necesitan bcrypt/salt por su baja entropía).
 *
 * Outbound (nosotros → webhook de la empresa): HMAC-SHA256, timing-safe, con
 * ventana de replay — copiado del patrón ya probado en supabase/functions/
 * kyc-webhook/index.ts (ahí lo usa Didit contra nosotros; acá jugamos el rol
 * que ahí juega Didit).
 */

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ApiCredentialContext {
  credentialId:   string;
  organizationId: string;
  organization: {
    id:              string;
    name:            string;
    isApiEnabled:    boolean;
    apiWebhookUrl:   string | null;
    apiWebhookSecret: string | null;
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Genera un secret de API nuevo: "sfd_sk_" + 32 bytes random en base64url. */
export function generateApiSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `sfd_sk_${b64url}`;
}

/** Genera un key_id público corto para mostrar en el panel (no es secreto). */
export function generateApiKeyId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `ak_${hex}`;
}

/**
 * Valida el header Authorization: Bearer <secret> contra api_credentials y
 * confirma que la organización dueña tiene is_api_enabled = true.
 * Devuelve null si la credencial no es válida — el caller decide el status code.
 */
export async function authenticateApiRequest(
  supabase: SupabaseClient,
  req: Request
): Promise<ApiCredentialContext | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const secret = match[1].trim();
  if (!secret) return null;

  const secretHash = await sha256Hex(secret);

  const { data: credential } = await supabase
    .from("api_credentials")
    .select("id, organization_id, status, organizations(id, name, is_api_enabled, api_webhook_url, api_webhook_secret)")
    .eq("secret_hash", secretHash)
    .maybeSingle();

  if (!credential || credential.status !== "ACTIVE") return null;

  const org = credential.organizations as unknown as {
    id: string; name: string; is_api_enabled: boolean;
    api_webhook_url: string | null; api_webhook_secret: string | null;
  } | null;
  if (!org || !org.is_api_enabled) return null;

  // Fire-and-forget: registrar último uso, no bloquea la respuesta.
  supabase
    .from("api_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", credential.id)
    .then(() => {}, () => {});

  return {
    credentialId:   credential.id,
    organizationId: credential.organization_id,
    organization: {
      id:               org.id,
      name:             org.name,
      isApiEnabled:     org.is_api_enabled,
      apiWebhookUrl:    org.api_webhook_url,
      apiWebhookSecret: org.api_webhook_secret,
    },
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

/** Firma un payload de webhook saliente — mismo esquema que kyc-webhook espera del lado emisor. */
export function signWebhookPayload(secret: string, canonicalBody: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${canonicalBody}`, "utf8").digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  canonicalBody: string,
  timestamp: number,
  signature: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (Math.abs(nowSeconds - timestamp) > 300) return false;
  const expected = signWebhookPayload(secret, canonicalBody, timestamp);
  return timingSafeEqual(expected, signature);
}
