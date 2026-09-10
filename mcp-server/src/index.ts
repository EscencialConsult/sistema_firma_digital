#!/usr/bin/env node
/**
 * Servidor MCP — Firma Electrónica (SOLO local, SOLO SUPER_ADMIN).
 *
 * Corre por stdio para uso con Claude Desktop / Claude Code en la máquina
 * local de Facundo. NUNCA desplegar esto en un servidor ni exponerlo a
 * internet — usa la service_role key de Supabase, que bypassea toda RLS.
 * No es para empresas clientes: ellas se integran solo por la REST API
 * pública (supabase/functions/api-*).
 *
 * Ver README.md para instalación y configuración en Claude Desktop/Code.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerCredentialTools } from "./tools/credentials.js";
import { registerWebhookTools } from "./tools/webhooks.js";

const server = new McpServer({
  name: "firma-electronica-mcp-server",
  version: "1.0.0",
});

registerOrganizationTools(server);
registerCredentialTools(server);
registerWebhookTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[firma-electronica-mcp-server] conectado por stdio — esperando llamadas de Claude.");
}

main().catch((err) => {
  console.error("[firma-electronica-mcp-server] error fatal:", err);
  process.exit(1);
});
