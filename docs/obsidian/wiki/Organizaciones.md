# Organizaciones — Sistema Firma Digital

> Ver también: [[Arquitectura]] | [[Auth_Flow]] | [[Firma_Flow]] | [[Contratos]]

## Modelo multi-tenant

Cada organización es un tenant aislado. La empresa "Escencial Consultora" es el SUPER_ADMIN y puede crear organizaciones cliente.

```sql
organizations
  ├── id (UUID)
  ├── name
  ├── slug (único)               → define la URL del portal: laws.../escencial-s-a-s
  ├── didit_workflow_id          → workflow de KYC para los usuarios de esta org
  ├── plan ('FREE', ...)
  ├── is_active
  ├── max_users
  ├── contact_email
  ├── phone
  ├── address / city / province
  ├── cuil_cuit                  → variable {{cuit_empresa}} en plantillas
  ├── legal_representative       → variable {{representante_legal}} en plantillas
  └── logo_dark_url / logo_light_url / brand_primary / brand_secondary
```

## Membresías (`organization_memberships`)

Un usuario puede pertenecer a múltiples organizaciones. Esta tabla lo gestiona.

```sql
organization_memberships
  ├── id
  ├── user_id    → FK a users
  ├── organization_id → FK a organizations
  ├── status: 'pending' | 'active' | 'rejected'
  └── created_at
```

`fetchProfile()` en `auth.service.ts` consulta esta tabla para construir `memberOrgIds` y `isMultiOrg` en el `AuthUser`.

### Flujo de acceso a portal de org (v0.2.3+)

Cuando un usuario llega a `/:slug`:

1. Si **no tiene cuenta** → formulario de login/registro
2. Si **tiene cuenta y es miembro activo** → auto-redirige a `/dashboard`
3. Si **tiene cuenta y solicitud pendiente** → muestra "Solicitud en revisión"
4. Si **tiene cuenta pero no es miembro** → muestra "Acceso restringido"
   - Puede hacer click en "Solicitar acceso" → crea fila `pending` en `organization_memberships`
   - O pedir a un responsable el link de invitación de la empresa

El admin aprueba desde `AdminTeamPage` → cambia status a `active`.

## Autoridades (`organization_authorities`)

Sistema de validez legal: una organización debe tener al menos 1 autoridad `ACTIVE` para poder crear contratos.

```sql
organization_authorities
  ├── id
  ├── organization_id
  ├── type: 'PERMANENT' | 'PROVISIONAL'
  ├── status: 'PENDING' | 'ACTIVE' | 'REVOKED'
  ├── full_name / email / cuil / position
  ├── document_id        → FK a documents (convenio que activa PROVISIONAL)
  ├── signing_request_id → FK a signature_requests (firma del convenio)
  └── invite_token       → token para que la autoridad acepte por email
```

### Flujo autoridad PERMANENT

1. Admin crea autoridad PERMANENT desde panel
2. La autoridad recibe email con link `/authority/accept/:token`
3. Acepta → `status = 'ACTIVE'`

### Flujo autoridad PROVISIONAL (en desarrollo)

1. Admin crea autoridad PROVISIONAL con datos de convenio
2. Se genera un documento (convenio) + signature_request
3. La autoridad firma el convenio desde `/signing/:id`
4. Al firmar → `status = 'ACTIVE'`

## Configuración de la org (AdminSettingsPage)

Los campos de configuración tienen iconos ⓘ que indican qué variable de plantilla mapean:

| Campo | Variable en plantilla |
|---|---|
| Nombre legal | `{{razon_social}}` · `{{nombre_empresa}}` |
| CUIT/CUIL | `{{cuit_empresa}}` · `{{cuit_consultora}}` |
| Email | `{{email_empresa}}` |
| Teléfono | `{{telefono_empresa}}` |
| Dirección | `{{direccion_empresa}}` |
| Ciudad | `{{ciudad_empresa}}` |
| Provincia | `{{provincia_empresa}}` |

## Portal de org (JoinOrgPage)

URL: `/:slug` → `features/join/JoinOrgPage.tsx`

- Aplica el tema de color de la org (brandPrimary) al cargar
- Guarda el slug en `localStorage("lastOrgSlug")` para el redirect post-logout
- Panel izquierdo: branding (solo desktop)
- Panel derecho: form de login/registro o estados de membresía

## RLS y organización

Todas las tablas tienen RLS activado. Las políticas generalmente usan:

```sql
-- Usando JWT claim (cuando está disponible)
(auth.jwt() ->> 'organization_id')::uuid = organization_id

-- O subquery como fallback (siempre preferir este en Edge Functions)
(SELECT organization_id FROM public.users WHERE id = auth.uid()) = organization_id
```

## SUPER_ADMIN (Escencial Consultora)

- No pertenece a ninguna organización
- Accede a `/super-admin` con panel global
- Ve todas las organizaciones, puede crear nuevas
- Su JWT no tiene `organization_id` en claims → no puede crear documentos desde la UI de org

## Corrección de datos huérfanos (SQL)

Si hay registros sin `organization_id`:

```sql
DO $$
DECLARE v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE name ILIKE '%escencial%' LIMIT 1;
  UPDATE public.users SET organization_id = v_org_id WHERE organization_id IS NULL AND role != 'SUPER_ADMIN';
  UPDATE public.documents SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.signature_requests SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.identity_verifications SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.audit_logs SET organization_id = v_org_id WHERE organization_id IS NULL;
END $$;
```
