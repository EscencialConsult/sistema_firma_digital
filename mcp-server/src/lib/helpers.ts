/**
 * Helpers compartidos por los tools MCP: formateo de respuestas y
 * resolución de organización por id o slug.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { supabase } from "../supabaseClient.js";

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export interface OrgLookupInput {
  organizationId?: string;
  slug?: string;
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
}

/**
 * Resuelve una organización por organizationId o slug (al menos uno debe
 * venir con valor). Devuelve null si no se encontró o si no vino ninguno
 * de los dos.
 */
export async function resolveOrganization(input: OrgLookupInput): Promise<OrgRow | null> {
  if (input.organizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", input.organizationId)
      .maybeSingle();
    return data ?? null;
  }
  if (input.slug) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", input.slug)
      .maybeSingle();
    return data ?? null;
  }
  return null;
}
