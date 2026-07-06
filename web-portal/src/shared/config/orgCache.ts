/**
 * orgCache — cachea nombre y logos de la org activa en localStorage.
 * Permite mostrar el logo y nombre correctos ANTES de que llegue la respuesta de Supabase.
 */

const KEY = "org_cache";

export interface CachedOrg {
  name: string;
  slug?: string;
  logoDarkUrl?: string | null;
  logoLightUrl?: string | null;
}

export function saveOrgCache(org: CachedOrg): void {
  try { localStorage.setItem(KEY, JSON.stringify(org)); } catch { /* storage lleno */ }
}

export function loadOrgCache(): CachedOrg | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function clearOrgCache(): void {
  try { localStorage.removeItem(KEY); } catch { /* no-op */ }
}
