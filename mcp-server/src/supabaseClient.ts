/**
 * Cliente de Supabase para el servidor MCP — SIEMPRE con service_role key.
 *
 * Este cliente bypassea TODAS las políticas RLS. Es intencional: este
 * servidor lo usa únicamente Facundo (SUPER_ADMIN) desde su máquina local,
 * nunca se despliega ni se expone a internet. Ver README.md.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    [
      "[firma-electronica-mcp-server] Faltan variables de entorno.",
      "",
      "Necesitás SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY definidas en mcp-server/.env",
      "Copiá mcp-server/.env.example a mcp-server/.env y completá con las credenciales",
      "reales del proyecto Supabase (Project Settings → API).",
      "",
      "ATENCIÓN: SUPABASE_SERVICE_ROLE_KEY tiene acceso total y bypassea RLS —",
      "nunca la compartas, nunca la subas a git, nunca corras este servidor fuera",
      "de tu máquina local.",
    ].join("\n")
  );
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
