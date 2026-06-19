# Arquitectura — Sistema Firma Digital

> Ver también: [[Index_Proyecto]] | [[Auth_Flow]] | [[Edge_Functions]]

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 8 + TypeScript + Tailwind CSS |
| Router | React Router v6 |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Edge Functions | Deno (en `supabase/functions/`) |
| PDF | jsPDF (client-side) |
| KYC / Face | DIDIT v3 API |
| Deploy frontend | Netlify |
| Deploy backend | Supabase cloud |

## Estructura del frontend (`web-portal/src/`)

```
app/
  guards/         → AuthGuard, VerifiedGuard, AdminGuard, SuperAdminGuard
  layouts/        → AppLayout, AdminLayout, AuthLayout, KycLayout, SuperAdminLayout
  providers/      → AuthProvider (contexto global de auth)
  router/         → AppRouter.tsx (todas las rutas)
features/
  auth/           → LoginPage, RegisterPage
  dashboard/      → DashboardPage (user)
  admin/          → AdminDashboardPage, AdminUsersPage, AdminKycReviewPage, AdminContractsPage...
  kyc/            → KycWizardPage, KycPendingPage, KycRejectedPage
  signing/        → SigningFlowPage (flujo completo de firma)
  signatures/     → SignaturesPage, PublicSigningPage
  authority/      → AuthorityAcceptPage
  super-admin/    → SuperAdminDashboardPage, OrganizationsPage...
shared/
  config/         → app.ts (APP_CONFIG con version)
  services/       → auth.service, contracts.service, signing.service, kyc.service
  types/          → user.ts, contract.ts, signing.ts, kyc.ts
  lib/            → supabase.ts (client singleton)
  utils/          → generateSignedPdf.ts
```

## Base de datos (tablas principales)

| Tabla | Descripción |
|---|---|
| `users` | Perfil extendido del auth.users. Tiene `role`, `verification_status`, `organization_id` |
| `organizations` | Empresas/tenants. Tienen `didit_workflow_id`, `plan`, `is_active` |
| `documents` | Contratos/documentos a firmar. `status`, `organization_id`, `final_pdf_url` |
| `document_versions` | Versiones de PDF del documento. `sha256_hash`, `storage_path` |
| `signature_requests` | Solicitud de firma por firmante. `status`, `signer_email`, `token` |
| `signatures` | Firma efectuada. `signature_data` (canvas base64), `signed_at` |
| `identity_verifications` | KYC de usuario. `status`, `provider_session_id`, `organization_id` |
| `organization_authorities` | Autoridades (PERMANENT/PROVISIONAL). `type`, `status`, `document_id` |
| `conformity_acceptances` | Registro de aceptación de términos por firmante |
| `otp_challenges` | Códigos OTP para verificación en firma |
| `audit_logs` | Log de auditoría de todas las acciones |

## Multi-tenancy

- Todas las tablas tienen `organization_id UUID` con FK a `organizations`
- RLS (Row Level Security) filtra por `organization_id` usando JWT claims o subquery a `users`
- Trigger `fn_propagate_org` copia automáticamente el `organization_id` del usuario al insertar en `documents` e `identity_verifications`
- **Gotcha**: el JWT puede NO tener `organization_id` si el hook de Supabase no está configurado → siempre hacer fallback a `SELECT organization_id FROM users WHERE id = auth.uid()`

## Storage buckets

| Bucket | Contenido | Público |
|---|---|---|
| `contract-pdfs` | PDFs de documentos subidos | Sí |
| `org-logos` | Logos de organizaciones | Sí |
| `signed-contracts` | PDFs consolidados firmados | Sí |

## Vite 8 — configuración crítica

```ts
// vite.config.ts — NO usar estas formas antiguas:
// manualChunks: { "vendor": [...] }  ← objeto NO funciona
// minify: "esbuild"                   ← eliminado en Vite 8

// Forma correcta:
manualChunks: (id) => {
  if (id.includes("react")) return "vendor-react";
  if (id.includes("@supabase")) return "vendor-supabase";
}
minify: "oxc"  // ← usar oxc
```
