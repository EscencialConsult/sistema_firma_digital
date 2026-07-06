import { type ReactNode, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { getMyOrganization } from "../../shared/services/organizations.service";
import { applyTheme, resetTheme } from "../../shared/config/theme";
import { saveOrgCache, clearOrgCache } from "../../shared/config/orgCache";

/**
 * ThemeProvider — aplica los 4 colores de marca de la org activa.
 *
 * Reglas:
 * - SUPER_ADMIN → siempre usa DEFAULT_THEME (negro/zinc). Su panel
 *   es interno y no debe verse afectado por colores de clientes.
 * - ORG_ADMIN / USER con org → carga la org y aplica sus colores.
 * - Sin usuario / sin org → resetea al DEFAULT_THEME.
 *
 * Los colores se consumen con CSS vars:
 *   var(--brand-primary)          → color principal
 *   var(--brand-primary-text)     → texto legible encima del principal
 *   var(--brand-primary-soft)     → versión tenue para chips/fondos
 *   var(--brand-accent)           → color de acento
 *   var(--brand-accent-text)      → texto legible encima del acento
 *   (ver theme.ts para la lista completa)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Mientras auth está cargando, el inline script de index.html ya aplicó
    // el cache de localStorage. No tocar nada para evitar flash de colores genéricos.
    if (loading) return;

    // Super admin: siempre negro. No mezclar colores de clientes.
    if (user?.role === "SUPER_ADMIN") {
      clearOrgCache();
      resetTheme();
      return;
    }

    if (!user?.organizationId) {
      clearOrgCache();
      resetTheme();
      return;
    }

    getMyOrganization()
      .then((org) => {
        if (!org) { clearOrgCache(); resetTheme(); return; }
        // Cachear nombre + logos para carga instantánea en próxima sesión
        saveOrgCache({
          name:         org.name,
          slug:         org.slug,
          logoDarkUrl:  org.logoDarkUrl,
          logoLightUrl: org.logoLightUrl,
        });
        applyTheme({
          primary:    org.brandPrimary    ?? undefined,
          secondary:  org.brandSecondary  ?? undefined,
          accent:     org.brandAccent     ?? undefined,
          background: org.brandBackground ?? undefined,
        });
      })
      .catch(() => resetTheme());
  }, [loading, user?.organizationId, user?.role]);

  return <>{children}</>;
}
