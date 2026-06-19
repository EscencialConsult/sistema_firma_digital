# CLAUDE.md — Sistema Firma Digital

## REGLA DE INICIO OBLIGATORIA

**Al iniciar cualquier sesión, antes de escanear el código base completo, debés leer:**
`docs/obsidian/wiki/Index_Proyecto.md`

Este índice contiene el mapa mental del proyecto y te ahorrará tiempo de búsqueda.

---

## Reglas del proyecto

- **Versión:** Cada commit debe bumppear la versión en `web-portal/src/shared/config/app.ts` → `APP_CONFIG.version`
- **Push:** Preguntar siempre antes de hacer push a cualquier rama remota
- **Commits:** Usar mensajes descriptivos en español o inglés con el patrón `tipo: descripción`
- **Stack principal:** React + Vite 8 + TypeScript + Tailwind (web-portal) + Supabase (backend)
- **No mockear la DB en tests** — usar siempre datos reales
- **Idioma respuestas:** Castellano rioplatense, directo, sin relleno

## Memoria del sistema

- Wiki técnica: `docs/obsidian/wiki/`
- Logs de sesión: `docs/obsidian/raw/`
- Memoria de usuario (cross-proyecto): `C:\Users\PERSONAL\.claude\projects\...\memory\`
