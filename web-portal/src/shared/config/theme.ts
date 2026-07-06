/**
 * theme.ts — Fuente única de colores de marca de la plataforma.
 *
 * - Todos los colores dinámicos se exponen como CSS custom properties.
 * - ThemeProvider aplica los colores de la org activa y calcula
 *   automáticamente los colores de texto con contraste WCAG-AA garantizado.
 * - SUPER_ADMIN siempre usa DEFAULT_THEME (negro/zinc) — ver ThemeProvider.
 *
 * Cómo usar en componentes:
 *   style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-text)' }}
 *
 * Variables disponibles:
 *   --brand-primary          → color principal
 *   --brand-primary-text     → texto legible SOBRE --brand-primary (auto)
 *   --brand-primary-soft     → versión tenue al 12% para fondos/chips
 *   --brand-secondary        → color secundario
 *   --brand-secondary-text   → texto legible SOBRE --brand-secondary (auto)
 *   --brand-accent           → color de acento
 *   --brand-accent-text      → texto legible SOBRE --brand-accent (auto)
 *   --brand-accent-soft      → versión tenue al 12% para chips
 *   --brand-bg               → fondo de marca
 *   --brand-bg-text          → texto legible SOBRE --brand-bg (auto)
 */

export interface BrandTheme {
  /** Color principal — botones de acción, nav activo, highlights */
  primary:    string;
  /** Color secundario — fondos suaves, elementos de apoyo */
  secondary:  string;
  /** Color de acento — badges, calls-to-action secundarios */
  accent:     string;
  /** Color de fondo de marca — sidebar, cards, page bg */
  background: string;
}

export const DEFAULT_THEME: BrandTheme = {
  primary:    "#18181b",  // zinc-900
  secondary:  "#6366f1",  // indigo-500
  accent:     "#f59e0b",  // amber-500
  background: "#fafafa",  // zinc-50
};

export const CSS_VARS = {
  primary:         "--brand-primary",
  primaryText:     "--brand-primary-text",
  primarySoft:     "--brand-primary-soft",
  secondary:       "--brand-secondary",
  secondaryText:   "--brand-secondary-text",
  accent:          "--brand-accent",
  accentText:      "--brand-accent-text",
  accentSoft:      "--brand-accent-soft",
  background:      "--brand-bg",
  backgroundText:  "--brand-bg-text",
} as const;

// ─── Contraste WCAG-AA ────────────────────────────────────────────────────────

/**
 * Calcula la luminancia relativa de un color hex (#rrggbb).
 * Fórmula: WCAG 2.1 §1.4.3
 */
function getLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Devuelve el color de texto (negro o blanco) con contraste WCAG-AA
 * garantizado para usar SOBRE el color de fondo dado.
 */
export function getContrastText(hex: string): string {
  return getLuminance(hex) > 0.179 ? "#09090b" : "#ffffff";
}

/**
 * Convierte un hex #rrggbb a rgba con alfa dado (0–1).
 * Para chips y fondos tenues.
 */
function hexToSoft(hex: string, alpha = 0.12): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Aplica los 4 colores de marca al :root y los cachea en localStorage
 * para que el inline script de index.html los aplique instantáneamente
 * en la próxima carga (sin flash de colores por defecto).
 *
 * @param cache - false solo para resetTheme (evita guardar DEFAULT_THEME)
 */
export function applyTheme(theme: Partial<BrandTheme>, { cache = true }: { cache?: boolean } = {}): void {
  const t    = { ...DEFAULT_THEME, ...filterEmpty(theme) };
  const root = document.documentElement;

  const computed = {
    primary:         t.primary,
    primaryText:     getContrastText(t.primary),
    primarySoft:     hexToSoft(t.primary),
    secondary:       t.secondary,
    secondaryText:   getContrastText(t.secondary),
    accent:          t.accent,
    accentText:      getContrastText(t.accent),
    accentSoft:      hexToSoft(t.accent),
    background:      t.background,
    backgroundText:  getContrastText(t.background),
  };

  root.style.setProperty(CSS_VARS.primary,        computed.primary);
  root.style.setProperty(CSS_VARS.primaryText,     computed.primaryText);
  root.style.setProperty(CSS_VARS.primarySoft,     computed.primarySoft);
  root.style.setProperty(CSS_VARS.secondary,       computed.secondary);
  root.style.setProperty(CSS_VARS.secondaryText,   computed.secondaryText);
  root.style.setProperty(CSS_VARS.accent,          computed.accent);
  root.style.setProperty(CSS_VARS.accentText,      computed.accentText);
  root.style.setProperty(CSS_VARS.accentSoft,      computed.accentSoft);
  root.style.setProperty(CSS_VARS.background,      computed.background);
  root.style.setProperty(CSS_VARS.backgroundText,  computed.backgroundText);

  if (cache) {
    try { localStorage.setItem("brand_theme", JSON.stringify(computed)); } catch { /* storage lleno o bloqueado */ }
  }
}

/** Restaura el tema por defecto (logout o SUPER_ADMIN) — limpia el caché */
export function resetTheme(): void {
  try { localStorage.removeItem("brand_theme"); } catch { /* no-op */ }
  applyTheme(DEFAULT_THEME, { cache: false });
}

function filterEmpty(obj: Partial<BrandTheme>): Partial<BrandTheme> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => !!v)
  ) as Partial<BrandTheme>;
}
