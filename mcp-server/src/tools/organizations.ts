/**
 * Tools MCP — organizaciones y su configuración de API B2B.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../supabaseClient.js";
import { errorResult, resolveOrganization, textResult } from "../lib/helpers.js";

const orgLookupShape = {
  organizationId: z.string().uuid().optional().describe("UUID de la organización (usar este o slug)"),
  slug: z.string().optional().describe("Slug de la organización (usar este o organizationId)"),
};

export function registerOrganizationTools(server: McpServer): void {
  server.registerTool(
    "list_api_orgs",
    {
      title: "Listar organizaciones con API habilitada",
      description:
        "Lista las organizaciones con is_api_enabled=true, mostrando cuántas credenciales de API ACTIVAS tiene cada una y si tienen api_webhook_url configurado.",
      inputSchema: {},
    },
    async () => {
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, slug, api_webhook_url")
        .eq("is_api_enabled", true)
        .order("name");

      if (error) return errorResult(`Error consultando organizations: ${error.message}`);
      if (!orgs || orgs.length === 0) {
        return textResult("No hay organizaciones con la API habilitada (is_api_enabled = true).");
      }

      const rows = await Promise.all(
        orgs.map(async (org) => {
          const { count } = await supabase
            .from("api_credentials")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("status", "ACTIVE");
          return { ...org, activeCredentials: count ?? 0 };
        })
      );

      const lines = rows.map(
        (r) =>
          `- ${r.name} (slug: ${r.slug})\n` +
          `  id: ${r.id}\n` +
          `  credenciales activas: ${r.activeCredentials}\n` +
          `  webhook: ${r.api_webhook_url ?? "sin configurar"}`
      );

      return textResult(`Organizaciones con API habilitada (${rows.length}):\n\n${lines.join("\n\n")}`);
    }
  );

  server.registerTool(
    "enable_api_for_org",
    {
      title: "Habilitar API para una organización",
      description:
        "Activa is_api_enabled=true para la organización indicada (por organizationId o slug). " +
        "IMPORTANTE: antes de habilitar, chequeá get_org_authority_status — sin una autoridad " +
        "PERMANENT con status ACTIVE, la API va a fallar al generar contratos para esta organización.",
      inputSchema: orgLookupShape,
    },
    async (input) => {
      const org = await resolveOrganization(input);
      if (!org) return errorResult("No se encontró la organización con ese organizationId/slug.");

      const { error } = await supabase.from("organizations").update({ is_api_enabled: true }).eq("id", org.id);
      if (error) return errorResult(`Error habilitando la API: ${error.message}`);

      const { data: authority } = await supabase
        .from("organization_authorities")
        .select("id")
        .eq("organization_id", org.id)
        .eq("type", "PERMANENT")
        .eq("status", "ACTIVE")
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const warning = authority
        ? ""
        : "\n\nADVERTENCIA: esta organización no tiene ninguna autoridad PERMANENT con status ACTIVE. " +
          "La generación de contratos vía API va a fallar hasta que se configure una " +
          "(usá get_org_authority_status para confirmar).";

      return textResult(`API habilitada para "${org.name}" (${org.slug}).${warning}`);
    }
  );

  server.registerTool(
    "disable_api_for_org",
    {
      title: "Deshabilitar API para una organización",
      description: "Activa is_api_enabled=false para la organización indicada (por organizationId o slug). Corta el acceso a la API B2B de inmediato.",
      inputSchema: orgLookupShape,
    },
    async (input) => {
      const org = await resolveOrganization(input);
      if (!org) return errorResult("No se encontró la organización con ese organizationId/slug.");

      const { error } = await supabase.from("organizations").update({ is_api_enabled: false }).eq("id", org.id);
      if (error) return errorResult(`Error deshabilitando la API: ${error.message}`);

      return textResult(`API deshabilitada para "${org.name}" (${org.slug}).`);
    }
  );

  server.registerTool(
    "get_org_authority_status",
    {
      title: "Chequear autoridad activa de una organización",
      description:
        "Busca en organization_authorities la autoridad PERMANENT con status ACTIVE más reciente de la organización. " +
        "Es la PRECONDICIÓN a chequear antes de habilitar la API para una organización con enable_api_for_org: " +
        "sin una autoridad activa, la API va a fallar al generar contratos.",
      inputSchema: orgLookupShape,
    },
    async (input) => {
      const org = await resolveOrganization(input);
      if (!org) return errorResult("No se encontró la organización con ese organizationId/slug.");

      const { data: authority, error } = await supabase
        .from("organization_authorities")
        .select("id, full_name, email, type, status, accepted_at")
        .eq("organization_id", org.id)
        .eq("type", "PERMANENT")
        .eq("status", "ACTIVE")
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return errorResult(`Error consultando organization_authorities: ${error.message}`);

      if (!authority) {
        return textResult(
          `Organización: ${org.name} (${org.slug})\n\n` +
            "SIN AUTORIDAD ACTIVA — la API va a fallar para esta organización hasta que se " +
            "configure una autoridad PERMANENT con status ACTIVE."
        );
      }

      return textResult(
        `Organización: ${org.name} (${org.slug})\n\n` +
          "Autoridad activa:\n" +
          `- ${authority.full_name} <${authority.email}>\n` +
          `  tipo: ${authority.type}\n` +
          `  status: ${authority.status}\n` +
          `  aceptada: ${authority.accepted_at ?? "—"}`
      );
    }
  );

  server.registerTool(
    "set_api_template_binding",
    {
      title: "Configurar binding de plantilla para la API",
      description:
        "Crea o actualiza (upsert por organization_id + api_slug) el binding entre una plantilla de contrato " +
        "y un slug público estable que la empresa cliente usa en el payload de la API, en api_template_bindings.",
      inputSchema: {
        organizationId: z.string().uuid().describe("UUID de la organización"),
        contractTemplateId: z.string().uuid().describe("UUID de la plantilla (contract_templates.id)"),
        apiSlug: z.string().min(1).describe("Slug público estable que la empresa usa en el payload de la API (no expone el UUID interno)"),
        isEnabled: z.boolean().default(true).describe("Si el binding queda habilitado (default true)"),
      },
    },
    async ({ organizationId, contractTemplateId, apiSlug, isEnabled }) => {
      const { error } = await supabase.from("api_template_bindings").upsert(
        {
          organization_id: organizationId,
          contract_template_id: contractTemplateId,
          api_slug: apiSlug,
          is_enabled: isEnabled,
        },
        { onConflict: "organization_id,api_slug" }
      );

      if (error) return errorResult(`Error en el upsert de api_template_bindings: ${error.message}`);

      return textResult(
        `Binding guardado: apiSlug="${apiSlug}" → plantilla ${contractTemplateId} (org ${organizationId}), ` +
          `habilitado: ${isEnabled}.`
      );
    }
  );

  server.registerTool(
    "list_org_templates_for_api",
    {
      title: "Listar plantillas de una organización habilitadas para la API",
      description: "Lista los bindings de api_template_bindings de una organización, con el nombre y tipo de la plantilla (join con contract_templates).",
      inputSchema: {
        organizationId: z.string().uuid().describe("UUID de la organización"),
      },
    },
    async ({ organizationId }) => {
      const { data, error } = await supabase
        .from("api_template_bindings")
        .select("id, api_slug, is_enabled, created_at, contract_templates(id, name, template_type)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) return errorResult(`Error consultando api_template_bindings: ${error.message}`);
      if (!data || data.length === 0) {
        return textResult("Esta organización no tiene plantillas configuradas para la API todavía.");
      }

      const lines = data.map((b) => {
        const tpl = b.contract_templates as unknown as { id: string; name: string; template_type: string } | null;
        return (
          `- apiSlug: "${b.api_slug}" ${b.is_enabled ? "(habilitado)" : "(deshabilitado)"}\n` +
          `  plantilla: ${tpl?.name ?? "(no encontrada)"} — tipo: ${tpl?.template_type ?? "—"}\n` +
          `  contractTemplateId: ${tpl?.id ?? "—"} | bindingId: ${b.id}`
        );
      });

      return textResult(`Plantillas de API (${data.length}):\n\n${lines.join("\n\n")}`);
    }
  );
}
