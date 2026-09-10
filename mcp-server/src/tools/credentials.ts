/**
 * Tools MCP — credenciales de API y visibilidad de solicitudes de firma.
 *
 * La generación de secrets sigue EXACTAMENTE el mismo esquema que la Edge
 * Function admin-api-credentials / supabase/functions/_shared/apiAuth.ts:
 *   - key_id: público, "ak_" + 6 bytes random en hex.
 *   - secret: "sfd_sk_" + 32 bytes random en base64url.
 *   - se guarda secret_hash = sha256(secret) en hex, nunca el secret en texto plano.
 */

import crypto from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../supabaseClient.js";
import { errorResult, textResult } from "../lib/helpers.js";

function generateApiSecret(): string {
  const b64url = crypto.randomBytes(32).toString("base64url");
  return `sfd_sk_${b64url}`;
}

function generateApiKeyId(): string {
  return `ak_${crypto.randomBytes(6).toString("hex")}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function registerCredentialTools(server: McpServer): void {
  server.registerTool(
    "generate_api_credential",
    {
      title: "Generar credencial de API",
      description:
        "Genera un par key_id/secret nuevo para una organización, guarda solo el hash SHA-256 del secret " +
        "en api_credentials (nunca el secret en texto plano) y devuelve el secret en la respuesta. " +
        "ESTA ES LA ÚNICA VEZ que el secret se muestra — no queda recuperable después de esta llamada.",
      inputSchema: {
        organizationId: z.string().uuid().describe("UUID de la organización dueña de la credencial"),
      },
    },
    async ({ organizationId }) => {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle();
      if (!org) return errorResult("No se encontró una organización con ese organizationId.");

      const secret = generateApiSecret();
      const keyId = generateApiKeyId();
      const secretHash = sha256Hex(secret);

      const { error } = await supabase.from("api_credentials").insert({
        organization_id: organizationId,
        key_id: keyId,
        secret_hash: secretHash,
        secret_last4: secret.slice(-4),
        status: "ACTIVE",
      });
      if (error) return errorResult(`Error insertando en api_credentials: ${error.message}`);

      return textResult(
        `Credencial generada para "${org.name}".\n\n` +
          `key_id: ${keyId}\n` +
          `secret: ${secret}\n\n` +
          "IMPORTANTE: este secret se muestra UNA SOLA VEZ y no queda recuperable desde la base " +
          "(solo se guarda su hash). Copialo ahora y entregaselo a la empresa cliente por un canal seguro."
      );
    }
  );

  server.registerTool(
    "revoke_api_credential",
    {
      title: "Revocar credencial de API",
      description: "Marca una credencial de api_credentials como REVOKED (status='REVOKED', revoked_at=now()). Deja de poder autenticar contra la API de inmediato.",
      inputSchema: {
        credentialId: z.string().uuid().describe("UUID de la fila en api_credentials"),
      },
    },
    async ({ credentialId }) => {
      const { data, error } = await supabase
        .from("api_credentials")
        .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
        .eq("id", credentialId)
        .select("id, key_id, organization_id")
        .maybeSingle();

      if (error) return errorResult(`Error revocando la credencial: ${error.message}`);
      if (!data) return errorResult("No se encontró una credencial con ese credentialId.");

      return textResult(`Credencial ${data.key_id} revocada (organización ${data.organization_id}).`);
    }
  );

  server.registerTool(
    "list_pending_contracts",
    {
      title: "Listar solicitudes de firma de una organización",
      description:
        "Lista signature_requests de una organización (con el título del documento via join), ordenadas por " +
        "fecha de creación descendente. Por defecto los últimos 20. Opcionalmente filtrar por status.",
      inputSchema: {
        organizationId: z.string().uuid().describe("UUID de la organización"),
        status: z.string().optional().describe("Filtrar por status de signature_requests (ej: PENDING, VIEWED, SIGNED, EXPIRED)"),
        limit: z.number().int().positive().max(100).default(20).describe("Cantidad máxima de resultados (default 20)"),
      },
    },
    async ({ organizationId, status, limit }) => {
      let query = supabase
        .from("signature_requests")
        .select("id, signer_name, signer_email, status, sent_at, viewed_at, signed_at, expires_at, created_at, documents(id, title)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return errorResult(`Error consultando signature_requests: ${error.message}`);
      if (!data || data.length === 0) {
        return textResult("No hay solicitudes de firma para esta organización con esos filtros.");
      }

      const lines = data.map((r) => {
        const doc = r.documents as unknown as { id: string; title: string } | null;
        return (
          `- ${doc?.title ?? "(sin documento)"}\n` +
          `  firmante: ${r.signer_name} <${r.signer_email}>\n` +
          `  status: ${r.status}\n` +
          `  enviado: ${r.sent_at ?? "—"} | visto: ${r.viewed_at ?? "—"} | firmado: ${r.signed_at ?? "—"} | vence: ${r.expires_at ?? "—"}\n` +
          `  id: ${r.id}`
        );
      });

      return textResult(`Solicitudes de firma (${data.length}):\n\n${lines.join("\n\n")}`);
    }
  );
}
