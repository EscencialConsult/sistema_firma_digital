# Index — Sistema Firma Digital

> Última actualización: 2026-06-19 | Versión actual: v0.1.2

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
| [[Auth_Flow]] | Login, roles, guards de rutas, JWT |
| [[KYC_Flow]] | Verificación de identidad con DIDIT |
| [[Firma_Flow]] | Flujo completo de firma de documentos |
| [[Edge_Functions]] | Edge functions de Supabase desplegadas |
| [[Organizaciones]] | Modelo de multi-tenancy, autoridades |

## Estado actual (v0.1.2)

### Completado
- [x] Auth multi-rol (SUPER_ADMIN, ORG_ADMIN, USER)
- [x] KYC con DIDIT (flujo completo con redirect + webhook)
- [x] Flujo de firma: OTP + verificación facial + firma manuscrita
- [x] PDF consolidado generado cuando todos los firmantes completan
- [x] Autoridades de organización (PERMANENT / PROVISIONAL)
- [x] Multi-tenancy con RLS por organization_id
- [x] Admin UI con gestión de contratos, users, KYC review
- [x] "Enviar al tercero" desde contratos completados
- [x] Fix: admins bypassan KYC en VerifiedGuard
- [x] Fix: IN_REVIEW bloquea dashboard, redirige a /kyc/pending
- [x] Fix: reset de sesión DIDIT trabada desde /kyc/pending

### Pendiente / En progreso
- [ ] Flujo provisional de autoridades completo
- [ ] AuthorityAcceptPage → redirigir al SigningFlow del convenio

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
