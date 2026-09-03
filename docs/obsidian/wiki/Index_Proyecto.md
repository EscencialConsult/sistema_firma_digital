# Index — Sistema Firma Digital

> Última actualización: 2026-07-29 | Versión actual: v0.2.4

## Mapa rápido del proyecto

```
sistema_firma_digital/
├── web-portal/          → Frontend React + Vite 8 + Tailwind
├── supabase/
│   ├── functions/       → Edge Functions (Deno)
│   └── migrations/      → SQL migrations numeradas
├── local-agent/         → Agente local (Node, secundario)
├── web-backend/         → Backend auxiliar (secundario)
└── docs/obsidian/       → Esta documentación
```

## Qué hace el sistema

Plataforma de firma digital multi-tenant para Argentina:
- Empresas (organizations) crean contratos y los mandan a firmar
- Los firmantes verifican identidad (DIDIT KYC) y firman con OTP + firma manuscrita digital
- El sistema genera un PDF consolidado con las firmas cuando todos completan
- Las autoridades de la organización validan la legitimidad de los contratos

## Índice de la wiki

| Archivo | Contenido |
|---|---|
| [[Arquitectura]] | Stack, estructura de BD, multi-tenancy |
| [[Auth_Flow]] | Login, roles, guards de rutas, JWT, logout redirect |
| [[KYC_Flow]] | Verificación de identidad con DIDIT |
| [[Firma_Flow]] | Flujo completo de firma de documentos |
| [[Edge_Functions]] | Edge functions de Supabase desplegadas |
| [[Organizaciones]] | Modelo de multi-tenancy, autoridades, acceso a portales |
| [[Contratos]] | Plantillas, variables de empresa, flujo de envío |

## Estado actual (v0.2.4)

### Completado ✅

**Core (v0.1.x)**
- [x] Auth multi-rol (SUPER_ADMIN, ORG_ADMIN, ADMIN, USER)
- [x] KYC con DIDIT (flujo completo con redirect + webhook)
- [x] Flujo de firma: OTP + verificación facial + firma manuscrita
- [x] PDF consolidado generado cuando todos los firmantes completan
- [x] Autoridades de organización (PERMANENT / PROVISIONAL)
- [x] Multi-tenancy con RLS por organization_id
- [x] Admin UI con gestión de contratos, users, KYC review
- [x] "Enviar al tercero" desde contratos completados

**Contratos y plantillas (v0.2.x)**
- [x] Variables de empresa en plantillas ({{razon_social}}, {{cuit_empresa}}, etc.)
- [x] Variables semi-automáticas: pre-rellenas desde config de org, editables
- [x] Chip "↩ Restaurar" cuando el admin edita un valor pre-completado
- [x] Tooltips ⓘ en AdminSettingsPage indicando qué variable mapea cada campo
- [x] Sanitización de nombre de archivo en uploads a Supabase Storage

**Auth y portales (v0.2.x)**
- [x] Login para usuarios registrados por invitación de org (proveedor email activado)
- [x] Link "Reenviar verificación" en LoginPage cuando hay error
- [x] Logout redirige según cantidad de orgs: 1 org → portal empresa, +1 org → /login
- [x] Bloqueo de acceso a portal de org sin membresía activa
- [x] Estado "Acceso restringido" con opción de solicitar acceso o pedir link de invitación

### Pendiente / En progreso 🔄

- [ ] Flujo provisional de autoridades completo
- [ ] AuthorityAcceptPage → redirigir al SigningFlow del convenio
- [ ] ProfilePage: sección "Identidad verificada" sin datos
- [ ] ContractsPage (usuario): restructurar con tabs recibidos/completados + download
- [ ] Eliminar contrato: bug reportado ("se rompe alguna función")
- [ ] SQL migration `20260716003_add_pdf_template_fields.sql` → aplicar en Supabase Dashboard

## Variables de entorno clave (Supabase)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DIDIT_API_KEY
DIDIT_API_URL=https://verification.didit.me
DIDIT_WORKFLOW_ID         → workflow Free KYC de DIDIT
DIDIT_CALLBACK_URL        → URL del kyc-webhook
```

## Convenciones críticas

- `organization_id` siempre en todas las tablas (multi-tenant)
- JWT puede NO tener `organization_id` en claims → siempre hacer fallback a `users` table
- Versión del app: `web-portal/src/shared/config/app.ts` → `APP_CONFIG.version`
- Migraciones: numeradas `20260620NNN_nombre.sql`
- Uploads a Storage: siempre sanitizar `file.name` antes de armar el path (`replace(/[^a-zA-Z0-9._-]/g, "_")`)
- `lastOrgSlug` en localStorage: lo escribe `cacheOrgSlug()` en AuthProvider, lo lee `AuthGuard`
