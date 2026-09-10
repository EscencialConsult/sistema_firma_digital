/**
 * Tools MCP — cola de eventos de webhook saliente (webhook_events).
 *
 * Este archivo NO recibe webhooks entrantes: administra la cola de eventos
 * que ESTE sistema envía hacia la empresa cliente (la firma HMAC saliente
 * vive en supabase/functions/_shared/apiAuth.ts::signWebhookPayload). Acá
 * solo se lee/actualiza el estado de esa cola vía service_role — no hay
 * ninguna petición HTTP entrante que verificar.
 * pagokit-ignore: webhook-has-signature -- cola de reintentos de webhooks salientes, no un receptor de webhooks entrantes.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../supabaseClient.js";
import { errorResult, textResult } from "../lib/helpers.js";

export function registerWebhookTools(server: McpServer): void {
  server.registerTool(
    "list_webhook_events",
    {
      title: "Listar eventos de webhook",
      description:
        "Lista webhook_events de una organización (últimos 20 por defecto), opcionalmente filtrados por status " +
        "(PENDING, DELIVERED, FAILED, DEAD).",
      inputSchema: {
        organizationId: z.string().uuid().describe("UUID de la organización"),
        status: z.enum(["PENDING", "DELIVERED", "FAILED", "DEAD"]).optional().describe("Filtrar por status"),
        limit: z.number().int().positive().max(100).default(20).describe("Cantidad máxima de resultados (default 20)"),
      },
    },
    async ({ organizationId, status, limit }) => {
      let query = supabase
        .from("webhook_events")
        .select("id, event_type, status, attempts, max_attempts, next_attempt_at, last_error, delivered_at, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return errorResult(`Error consultando webhook_events: ${error.message}`);
      if (!data || data.length === 0) {
        return textResult("No hay eventos de webhook para esta organización con esos filtros.");
      }

      const lines = data.map(
        (e) =>
          `- ${e.event_type} — ${e.status} (intento ${e.attempts}/${e.max_attempts})\n` +
          `  próximo intento: ${e.next_attempt_at ?? "—"} | entregado: ${e.delivered_at ?? "—"}\n` +
          `  último error: ${e.last_error ?? "—"}\n` +
          `  id: ${e.id}`
      );

      return textResult(`Eventos de webhook (${data.length}):\n\n${lines.join("\n\n")}`);
    }
  );

  server.registerTool(
    "retry_webhook_event",
    {
      title: "Reintentar un evento de webhook manualmente",
      description:
        "Resetea un webhook_event a status='PENDING' con next_attempt_at=now() para que el próximo dispatch " +
        "(cron o manual) lo recoja. Es el fallback manual para cuando pg_cron/pg_net no están disponibles " +
        "en el ambiente local.",
      inputSchema: {
        webhookEventId: z.string().uuid().describe("UUID de la fila en webhook_events"),
      },
    },
    async ({ webhookEventId }) => {
      const { data, error } = await supabase
        .from("webhook_events")
        .update({ status: "PENDING", next_attempt_at: new Date().toISOString() })
        .eq("id", webhookEventId)
        .select("id, event_type, organization_id")
        .maybeSingle();

      if (error) return errorResult(`Error reintentando el evento: ${error.message}`);
      if (!data) return errorResult("No se encontró un evento con ese webhookEventId.");

      return textResult(`Evento "${data.event_type}" (${data.id}) marcado como PENDING para reintento inmediato.`);
    }
  );
}
