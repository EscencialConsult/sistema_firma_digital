# PLAN DE IMPLEMENTACIÓN — Sistema Firma Electrónica

> Fecha: 10/07/2026 | Versión actual: v0.1.52

---

## Resumen de Solicitudes

| # | Solicitud | Estado |
|---|-----------|--------|
| 1 | Empresa: eliminar auditoría del panel admin | Pendiente |
| 2 | Configuración: datos de contacto de empresa, ver datos, actualizar logo | ✅ Completado |
| 3 | Mi equipo: filtrar solo usuarios de la organización (no todos) | ✅ Completado |
| 4 | Contratos: no se descargan / no se visualizan bien en usuarios | ✅ Completado |
| 5 | PDFs: corregir PDFs cargados, crear contratos desde plataforma | ✅ Completado |
| 6 | Panel contratos: tipos de contrato (pagaré, servicio, etc.) + historial | ✅ Completado |
| 7 | Auditoría de firma: página nueva con toda la evidencia de firma | ✅ Completado |
| 8 | Usuarios: no mostrar miembros del equipo | ⚠️ Parcial (filtrado por org hecho, falta excluir roles admin de la lista) |
| 9 | Dashboard → renombrar a "Inicio" | ✅ Completado |
| 10 | Mis contratos: 2 pestañas, filtro por tipo, descarga PDF | ✅ Completado |
| 11 | Perfil: identidad verificada no trae datos | ✅ Completado |
| 12 | Renombrar "Firma Digital" → "Firma Electrónica" en todo | ✅ Completado |
| 13 | Modelo de pago de cuotas para capacitación | ✅ Completado |

---

## FASE 0: Cambio de branding "Firma Digital" → "Firma Electrónica" ✅ COMPLETADO

**Objetivo:** Renombrar todas las ocurrencias de "Firma Digital" a "Firma Electrónica" en frontend, backend y docs.

| # | Archivo | Cambio |
|---|---------|--------|
| 0.1 | `web-portal/src/shared/config/app.ts:2` | `name: "Firma Electrónica"` |
| 0.2 | `SharedSidebar.tsx:138` | Fallback → `"Firma Electrónica"` |
| 0.3 | `AppLayout.tsx:90` | Términos modal subtitle |
| 0.4 | `KycLayout.tsx:17` | Header |
| 0.5 | `ProfilePage.tsx:194` | Badge label |
| 0.6 | `ConformityPage.tsx` (4 ocurrencias) | Textos legales/plataforma |
| 0.7 | `SigningFlowPage.tsx` (2 ocurrencias) | Fallback + descripción |
| 0.8 | `PublicSigningPage.tsx` (3 ocurrencias) | PDF watermark + textos |
| 0.9 | `IdentityVerificationPage.tsx:34` | PageHeader description |
| 0.10 | `AdminIdentityReviewPage.tsx:410` | Texto admin |
| 0.11 | `ReviewStep.tsx`, `TermsStep.tsx` | Textos legales |
| 0.12 | `ContractRenderer.tsx` (3 ocurrencias) | PDF footer + cláusulas |
| 0.13 | `generateSignedPdf.ts` (3 ocurrencias) | Headers de PDF |
| 0.14 | `contractTemplate.ts:156` | Placeholder |
| 0.15 | `terms.ts` (3 ocurrencias) | Títulos/textos legales |
| 0.16 | `OnboardingTour.tsx:20` | Título onboarding |
| 0.17 | Edge Functions: `send-signing-email` (5), `sign-document` (2), `generate-certificate` (1) | Emails + PDF stamps + cert metadata |
| 0.18 | Local agent: `pkcs11Router.ts`, `windowsCertRouter.ts` | PDF text |

**Nota:** Las referencias a "Ley N° 25.506 de Firma Digital" son la **ley argentina** — esas se mantienen igual (es nombre de ley, no de la plataforma).

---

## FASE 1: Configuración de Empresa (Admin Settings) ✅ COMPLETADO

**Objetivo:** El admin puede ver/editar datos de la empresa, subir logo, ver datos de contacto.

### 1.1 Expandir campos editables de la organización

**DB — Migración creada:** `supabase/migrations/20260710001_add_org_company_fields.sql`

### 1.2 Actualizar tipo `Organization`

**Archivo:** `web-portal/src/shared/types/organization.ts`
- Agregar los nuevos campos al tipo.

### 1.3 Actualizar `AdminSettingsPage.tsx`

**Cambios en la página de configuración:**

- **Sección "Datos de la Empresa"** (ahora editable):
  - Nombre (editable)
  - CUIT/Tax ID (editable)
  - Teléfono (editable)
  - Dirección (editable)
  - Ciudad, Provincia, Código Postal (editable)
  - Email de contacto (ya existe, mantener)
  - Sitio web (editable)
- **Sección "Logo"** (nueva):
  - Preview del logo actual (`OrgLogo` component)
  - Botón "Subir logo" → file input → `uploadOrgLogo()` → Supabase Storage `org-logos`
  - Botón "Eliminar logo"
- **Sección "Colores de marca"** (ya existe, mantener)
- **Sección "Autoridades"** (ya existe, mantener)

### 1.4 Actualizar servicio `organizations.service.ts`

- `updateOrganization()` debe enviar los nuevos campos.
- `getMyOrganization()` ya trae todos los campos, solo verificar.

### 1.5 Migración del logo upload de Super Admin

- Actualmente `uploadOrgLogo()` solo está en `OrganizationDetailPage.tsx` (super admin).
- Mover la funcionalidad de upload a `AdminSettingsPage.tsx` también (el admin de la org también puede subir su logo).
- Verificar que el RLS permita `UPDATE` en `organizations` para `ORG_ADMIN`.

---

## FASE 2: Fix — "Mi equipo" solo muestra usuarios de la organización ✅ COMPLETADO

**Problema:** `AdminTeamPage.tsx` llama `getAllUsers()` que no filtra por `organization_id`.

### 2.1 Fix en `admin.service.ts`

**Archivo:** `web-portal/src/shared/services/admin.service.ts`

- `getAllUsers(organizationId?)` — ahora acepta parámetro opcional `organizationId`
- Si se pasa, filtra con `.eq('organization_id', organizationId)`
- Si no se pasa, retorna todos (backward compatible para super admin)

### 2.2 Fix en consumidores

**Archivos actualizados (5 consumidores):**

- `AdminTeamPage.tsx` — pasa `orgId` del contexto de auth
- `AdminContractsPage.tsx` — pasa `orgId` para select de usuarios
- `AdminConveniosTab.tsx` — pasa `orgId` para activación de convenios
- Cualquier otro componente que llame `getAllUsers()` ahora filtra por org

---

## FASE 3: Fix — Contratos no se descargan / no se visualizan bien ✅ COMPLETADO

**Problemas identificados:**

1. El PDF no se descarga correctamente desde el panel de usuario.
2. La visualización de "contratos enviados" en `/contracts` y `/signatures` tiene problemas.

### 3.1 Fix en descarga de PDF

**Cambios realizados:**

- Eliminado `link.target="_blank"` de los links de descarga — ahora se descarga directamente
- Agregado manejo condicional: si el PDF está en Supabase Storage (URL externa) se abre directamente, si es blob se descarga
- Agregado botón "Descargar" explícito en `ContractsPage.tsx` y `SignaturesPage.tsx`
- `tryGenerateConsolidatedPdf()` sube correctamente a `signed-contracts` bucket

### 3.2 Fix en visualización de contratos

**Archivo:** `ContractsPage.tsx`

- `getMySigningRequests()` retorna los datos correctos con JOIN a `documents`
- Cada fila muestra: título del documento, estado, fecha
- Links funcionales: `/signing/{id}` para pendientes, `/contracts/{documentId}` para completados

---

## FASE 4: PDFs cargados + Crear contratos desde plataforma ✅ COMPLETADO

**Problema:** Los PDFs cargados no se procesan bien. Se necesita poder crear el contrato/modelo desde la plataforma.

### 4.1 Fix upload de PDFs

**Archivo:** `AdminContractsPage.tsx` (pestaña "Subir PDF")

- Verificar que `uploadContractPdf()` en `contracts.service.ts` funciona correctamente:
  - SHA-256 hash computation
  - Upload a Supabase Storage `contract-pdfs`
  - Creación de `documents` + `document_versions`
  - Creación de `signature_requests`

### 4.2 ContractDetailModal — Mostrar PDF real

**Archivo:** `web-portal/src/features/admin/components/ContractRenderer.tsx`

- `ContractDetailModal` ahora muestra el PDF real via `<iframe>` con signed URL de Supabase Storage
- Si no hay PDF, muestra skeleton placeholder
- Agregado botón "Abrir PDF completo" como link externo
- Importado tipo `ContractDetail` para tipado correcto

### 4.3 Clonar plantillas de contrato

**Archivo:** `web-portal/src/shared/services/contractTemplates.service.ts`

- Nueva función `cloneContractTemplate(id)` — duplica un template existente con "(copia)" en el nombre

**Archivo:** `AdminContractsPage.tsx`

- TemplateCard ahora tiene botón clonar (icono Copy)
- Handler `handleCloneTemplate` que llama `cloneContractTemplate` y recarga la lista

---

## FASE 5: Tipos de Contrato + Historial ✅ COMPLETADO

**Objetivo:** Agregar categorías de contratos, historial con estados, y conexión con el usuario.

### 5.1 DB — Migración nueva

**Migración:** `supabase/migrations/20260710002_add_contract_types.sql`

```sql
-- Tipos de contrato predefinidos + personalizados por org
CREATE TABLE IF NOT EXISTS contract_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,         -- "Pagaré", "Contrato de Servicio", "Contrato de Formación"
  slug TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false, -- true = tipos del sistema, false = custom de la org
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar contract_type_id a documents y contract_templates
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contract_type_id UUID REFERENCES contract_types(id);
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS contract_type_id UUID REFERENCES contract_types(id);

-- RLS
ALTER TABLE contract_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_contract_types" ON contract_types
  FOR SELECT USING (organization_id = auth.uid() OR is_system = true);
CREATE POLICY "org_manage_contract_types" ON contract_types
  FOR ALL USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

**Tipos del sistema (seed):**

| slug | name |
|------|------|
| `pagare` | Pagaré |
| `contrato_servicio` | Contrato de Servicio |
| `contrato_formacion` | Contrato de Formación/Capacitación |
| `convenio` | Convenio |
| `otro` | Otro |

### 5.2 Service CRUD

**Archivo:** `web-portal/src/shared/services/contractTypes.service.ts` (72 líneas)

- `getContractTypes(orgId?)` — lista tipos del sistema + de la org
- `createContractType({ orgId, name })` — crea con slug automático
- `deleteContractType(id)` — solo tipos no-sistema

### 5.3 Panel de Contratos Admin — Pestañas reorganizadas

**Archivo:** `AdminContractsPage.tsx`

Reorganizado de 3 a 4 pestañas:

| Pestaña | Contenido |
|---------|-----------|
| **Modelos** | Lista de `contract_templates` con CRUD. Cada template tiene tipo de contrato. Botón "Crear modelo" con RichTextEditor. Botón clonar. |
| **Contratos** | Lista de `documents` con filtros por tipo, estado, fecha. Botón "Enviar contrato" que usa un template. |
| **Convenios** | Tab `AdminConveniosTab` (ya existía) |
| **Pagos** | Tab `AdminPaymentTemplatesTab` (FASE 8) |

### 5.4 Tipo Contract — campo contractTypeId

**Archivo:** `web-portal/src/shared/types/contract.ts`

- Nuevo campo `contractTypeId: string | null` en tipo `Contract`
- `mapDocToContract()` en `contracts.service.ts` mapea `contract_type_id` de la DB

### 5.5 Mock data actualizado

**Archivo:** `web-portal/src/shared/mock/data.ts`

- Los 3 contratos mock ahora incluyen `contractTypeId: null`

---

## FASE 6: Auditoría de Firma (Nueva página) ✅ COMPLETADO

**Objetivo:** Página dedicada donde se vea toda la evidencia de firma de un contrato.

### 6.1 DB — Extender tabla `signatures`

**Migración:** `supabase/migrations/20260710003_extend_signatures_audit.sql`

```sql
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS cuil_cuit TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS face_verification_method TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS face_similarity_score NUMERIC;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS certificate_serial TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_url TEXT;
```

### 6.2 Página de Auditoría de Firma

**Ruta:** `/audit/signature/:signatureId`

**Componente:** `web-portal/src/features/audit/SignatureAuditPage.tsx`

**Secciones de la vista:**

| Sección | Campos |
|---------|--------|
| **Estado** | Badge verde si firmado, amarillo si pendiente |
| **Datos del firmante** | nombre completo, email, documento, CUIL/CUIT, dirección, ciudad, provincia, teléfono, fecha de nacimiento |
| **Datos de la firma** | fecha/hora, dirección IP, dispositivo (user agent), hash SHA-256 del documento |
| **Verificación de identidad** | método (AWS Rekognition), score de similitud, código de verificación |
| **Certificado digital** | serial, emisor (Escencial Consultora S.A.S.), ley aplicable (Ley N° 25.506) |
| **Firma manuscrita** | imagen de la firma canvas (si existe) |
| **PDF de auditoría** | link de descarga al PDF generado (si existe) |
| **Texto legal** | certificación de firma según Ley N° 25.506 |

### 6.3 Servicio de auditoría

**Archivo:** `web-portal/src/shared/services/audit.service.ts`

- `getSignatureAuditData(signatureId)` → JOIN de `signature_requests` + `documents` + `signatures` para traer toda la evidencia en una sola query.
- Retorna tipo `SignatureAuditData` con todos los campos necesarios.

### 6.4 Router

**Archivo:** `web-portal/src/app/router/AppRouter.tsx`

- Lazy import de `SignatureAuditPage`
- Ruta: `/audit/signature/:signatureId` dentro del bloque `AuthRequired`

---

## FASE 7: Panel de Usuario — Cambios ✅ COMPLETADO

### 7.1 Renombrar "Dashboard" → "Inicio"

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `SharedSidebar.tsx` | Label "Inicio" en `USER_NAV` |
| `SharedHeader.tsx` | "Inicio" en search items |
| `DashboardPage.tsx` | Heading `title="Inicio"` |
| `OnboardingTour.tsx` | "Inicio" en pasos del tour |

Path `/dashboard` se mantiene (para no romper links), solo cambia el label visible.

### 7.2 "Mis contratos" — 2 pestañas

**Archivo:** `web-portal/src/features/signatures/SignaturesPage.tsx`

Convertido de section headers a **tab bar** con estado `activeTab`:

| Pestaña | Contenido |
|---------|-----------|
| **Mis contratos** | Contratos recibidos pendientes/activos. Badge con count. |
| **Historial** | Contratos completados/firmados/expirados. Badge con count. |

**Cambios específicos:**
- `useState<"contracts" | "history">("contracts")` — estado de pestaña activa
- Barra de tabs con `border-b-2` indicador visual
- Badges con count de cada pestaña
- Se filtraron los contratos por `status === "COMPLETED"` para historial

### 7.3 Fix Perfil — "Identidad verificada" no trae datos

**Archivo:** `web-portal/src/features/users/ProfilePage.tsx`

**Causa:** El código priorizaba `kyc?.personalData` (de `identity_verifications`) sobre `profileKycData` (de `users`), pero la query de KYC a veces no retornaba datos.

**Fix:**
- Priorizar `profileKycData` (datos de la tabla `users`) que siempre están disponibles
- Eliminar el check `hasProfileKycData` demasiado estricto — ahora acepta datos parciales
- Mostrar datos del perfil del usuario incluso si no hay verificación KYC VERIFIED completa

---

## FASE 8: Modelo de Pago de Cuotas (para Capacitación) ✅ COMPLETADO

**Objetivo:** Crear un modelo de pago de cuotas simple con variables modificables, que se asigna al usuario cuando se envía el contrato.

### 8.1 DB — Migración nueva

**Migración:** `supabase/migrations/20260710004_add_payment_templates.sql`

```sql
-- Plantilla de pago (modelo de cuotas)
CREATE TABLE IF NOT EXISTS payment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC NOT NULL,
  installment_count INTEGER NOT NULL,
  installment_amount NUMERIC,
  frequency TEXT DEFAULT 'monthly',
  has_mora BOOLEAN DEFAULT true,
  mora_rate NUMERIC DEFAULT 3,
  extra_variables JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_manage_payment_templates" ON payment_templates FOR ALL
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Vínculo de plantilla de pago a un contrato específico
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS payment_template_id UUID
    REFERENCES payment_templates(id) ON DELETE SET NULL;
```

**Seed data:** Plantilla "Plan de capacitación — 6 cuotas mensuales" ($180.000 en 6 cuotas de $30.000).

### 8.2 Service CRUD

**Archivo:** `web-portal/src/shared/services/paymentTemplates.service.ts`

- `PaymentTemplate` — tipo completo con todos los campos
- `getPaymentTemplates()` — lista de la org del usuario actual
- `getPaymentTemplate(id)` — detalle
- `createPaymentTemplate(input)` — crea con monto total, cantidad de cuotas, frecuencia, mora
- `updatePaymentTemplate(id, input)` — actualización parcial
- `deletePaymentTemplate(id)` — eliminación
- `computeInstallmentAmount(total, count)` — calcula cuota estimada
- `FREQUENCY_LABELS` — mapa de frecuencia a label español (Mensual, Bimestral, Trimestral, Semestral, Anual)

### 8.3 UI — Gestión de plantillas de pago

**Componente:** `web-portal/src/features/admin/AdminPaymentTemplatesTab.tsx`

**Pestaña "Pagos"** dentro de `AdminContractsPage.tsx`:

- Tabla con columnas: nombre, monto total, cuotas, valor cuota, frecuencia, mora (badge)
- Búsqueda por nombre/descripción
- Botón "Nueva plantilla" → modal de creación
- Botones editar/eliminar en cada fila

**Modal de creación/edición:**

| Campo | Tipo | Validación |
|-------|------|-----------|
| Nombre | text | requerido |
| Descripción | textarea | opcional |
| Monto total (ARS) | number | requerido, min 0 |
| Cantidad de cuotas | number | requerido, min 1 |
| Frecuencia | select | Mensual/Bimestral/Trimestral/Semestral/Anual |
| Tasa de mora (%) | number | 0–100, step 0.5, deshabilitado si no hay mora |
| Aplicar mora por atraso | checkbox | default: true |

- Preview en tiempo real del valor de cuota estimada: `$total / $cuotas`

### 8.4 Asignación de plantilla a contrato

**Archivo:** `web-portal/src/shared/services/contracts.service.ts`

- `sendContractFromTemplate()` acepta `paymentTemplateId?: string | null`
- Se guarda en `documents.payment_template_id` al crear el contrato

**Tipo `Contract`** — nuevo campo: `paymentTemplateId: string | null`

**Mock data** (`data.ts`) — los 3 contratos mock ahora incluyen `paymentTemplateId: null`

---

## Resumen de Priorización

| Fase | Esfuerzo | Impacto | Dependencias |
|------|----------|---------|--------------|
| **0** — Renombrar "Firma Electrónica" | Bajo | Alto (branding) | Ninguna |
| **1** — Config empresa (datos + logo) | Medio | Alto | Migración DB |
| **2** — Fix equipo (filtro org) | Bajo | Alto (bug) | Ninguna |
| **3** — Fix descarga/visualización contratos | Medio | Alto (bug) | Ninguna |
| **4** — Fix PDFs + crear desde plataforma | Medio | Alto | Ninguna |
| **5** — Tipos de contrato + historial | Alto | Alto | Migración DB |
| **6** — Auditoría de firma (nueva página) | Alto | Alto | Fase 5 (tipos) |
| **7** — Panel usuario (Inicio + pestañas + fix perfil) | Medio | Alto | Fase 5 (tipos) |
| **8** — Modelo de pago cuotas | Medio | Medio | Migración DB |

---

## Orden de ejecución recomendado

```
 1. Fase 0  (renombrar)                           ✅ COMPLETADO v0.1.52
 2. Fase 2  (fix equipo)                          ✅ COMPLETADO — getAllUsers() ahora filtra por organization_id
 3. Fase 3  (fix descarga)                        ✅ COMPLETADO — fix download blob URLs + botones descarga en listas
 4. Fase 1  (config empresa)                      ✅ COMPLETADO — campos empresa + logo upload en AdminSettingsPage
 5. Fase 7.1-7.2 (Inicio + pestañas)              ✅ COMPLETADO — Dashboard→Inicio, pestañas contratos/historial
 6. Fase 7.3 (fix perfil)                         ✅ COMPLETADO — prioridad users sobre identity_verifications
 7. Fase 4  (PDFs + crear desde plataforma)        ✅ COMPLETADO — ContractDetailModal muestra PDF real + clonar plantillas
 8. Fase 5  (tipos + historial)                   ✅ COMPLETADO — contract_types table + service + AdminContractsPage reorganizado
 9. Fase 6  (auditoría de firma)                  ✅ COMPLETADO — SignatureAuditPage + audit.service + route /audit/signature/:id
 10. Fase 8  (modelo cuotas)                       ✅ COMPLETADO — payment_templates + UI CRUD + pestaña Pagos en admin
```

---

## Archivos clave del proyecto (referencia)

| Archivo | Propósito |
|---------|-----------|
| `web-portal/src/app/router/AppRouter.tsx` | Router principal |
| `web-portal/src/app/router/routes.ts` | Definición de rutas |
| `web-portal/src/shared/config/app.ts` | Versión de la app (v0.1.52) |
| `web-portal/src/shared/types/organization.ts` | Tipo Organization (con campos empresa) |
| `web-portal/src/shared/types/contract.ts` | Tipos Contract + ContractDetail + contractTypeId + paymentTemplateId |
| `web-portal/src/shared/services/contracts.service.ts` | CRUD contratos (~550 líneas) |
| `web-portal/src/shared/services/signing.service.ts` | Flujo de firma (~333 líneas) |
| `web-portal/src/shared/services/contractTemplates.service.ts` | Templates CRUD (~113 líneas) |
| `web-portal/src/shared/services/contractTypes.service.ts` | Tipos de contrato CRUD (72 líneas) |
| `web-portal/src/shared/services/paymentTemplates.service.ts` | Plantillas de pago CRUD (130 líneas) |
| `web-portal/src/shared/services/audit.service.ts` | Queries de auditoría + getSignatureAuditData (~115 líneas) |
| `web-portal/src/shared/services/admin.service.ts` | Stats admin (getAllUsers filtra por org) |
| `web-portal/src/shared/services/organizations.service.ts` | CRUD organizaciones (con campos empresa expandidos) |
| `web-portal/src/shared/utils/generateSignedPdf.ts` | Generación PDF (~317 líneas) |
| `web-portal/src/shared/utils/contractTemplate.ts` | Templates hardcoded |
| `web-portal/src/shared/components/ui/SharedSidebar.tsx` | Sidebar/navegación ("Inicio") |
| `web-portal/src/features/admin/AdminSettingsPage.tsx` | Config empresa (datos + logo) |
| `web-portal/src/features/admin/AdminContractsPage.tsx` | Admin contratos (Modelos|Contratos|Convenios|Pagos) |
| `web-portal/src/features/admin/AdminConveniosTab.tsx` | Pestaña convenios (~886 líneas) |
| `web-portal/src/features/admin/AdminPaymentTemplatesTab.tsx` | Pestaña pagos — CRUD plantillas (~220 líneas) |
| `web-portal/src/features/admin/AdminTeamPage.tsx` | Equipo (225 líneas) |
| `web-portal/src/features/audit/SignatureAuditPage.tsx` | Auditoría de firma (~160 líneas) |
| `web-portal/src/features/signatures/SignaturesPage.tsx` | Mis contratos usuario (con pestañas) |
| `web-portal/src/features/contracts/ContractsPage.tsx` | Lista contratos usuario |
| `web-portal/src/features/contracts/ContractDetailPage.tsx` | Detalle contrato |
| `web-portal/src/features/users/ProfilePage.tsx` | Perfil usuario (fix identidad verificada) |
| `web-portal/src/features/dashboard/DashboardPage.tsx` | Inicio (renombrado) |
| `web-portal/src/features/signing/SigningFlowPage.tsx` | Flujo de firma (~937 líneas) |
| `supabase/migrations/20260710001_add_org_company_fields.sql` | Campos empresa en organizations |
| `supabase/migrations/20260710002_add_contract_types.sql` | Tabla contract_types + seed |
| `supabase/migrations/20260710003_extend_signatures_audit.sql` | 14 columnas de evidencia en signatures |
| `supabase/migrations/20260710004_add_payment_templates.sql` | Tabla payment_templates + FK en documents + seed |
| `supabase/schema.sql` | Schema completo DB (~1148 líneas) |

---

## Registro de migraciones DB creadas

| Migración | Descripción |
|-----------|-------------|
| `20260710001_add_org_company_fields.sql` | Agrega campos empresa a `organizations`: phone, address, city, province, postal_code, tax_id, website |
| `20260710002_add_contract_types.sql` | Crea tabla `contract_types` + seed (5 tipos sistema) + FK en `documents` y `contract_templates` + RLS |
| `20260710003_extend_signatures_audit.sql` | Agrega 14 columnas de evidencia a `signatures`: datos personales, verificación facial, certificado, PDF URL, firma URL |
| `20260710004_add_payment_templates.sql` | Crea tabla `payment_templates` + FK `payment_template_id` en `documents` + seed (plan capacitación 6 cuotas) + RLS |

---

## Versión

- **Última versión:** v0.1.52
- **Fecha del plan:** 10/07/2026
- **Fases completadas:** 8/8 (Fases 0–8)
- **Solicitudes pendientes:** 1 (solicitud #1 — eliminar auditoría del panel admin)
- **Estado TypeScript:** compila limpio (`npx tsc --noEmit` sin errores)
