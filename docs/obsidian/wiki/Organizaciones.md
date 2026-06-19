# Organizaciones — Sistema Firma Digital

> Ver también: [[Arquitectura]] | [[Auth_Flow]] | [[Firma_Flow]]

## Modelo multi-tenant

Cada organización es un tenant aislado. La empresa "Escencial Consultora" es el SUPER_ADMIN y puede crear organizaciones cliente.

```
organizations
  ├── id (UUID)
  ├── name
  ├── slug (único)
  ├── didit_workflow_id  → workflow de KYC para los usuarios de esta org
  ├── plan ('FREE', ...)
  ├── is_active
  ├── max_users
  ├── contact_email
  └── logo_dark_url / logo_light_url / primary_color
```

## Autoridades (`organization_authorities`)

Sistema de validez legal: una organización debe tener al menos 1 autoridad `ACTIVE` para poder crear contratos.

```
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

## RLS y organización

Todas las tablas tienen RLS activado. Las políticas generalmente usan:
```sql
-- Usando JWT claim (cuando está disponible)
(auth.jwt() ->> 'organization_id')::uuid = organization_id

-- O subquery como fallback
(SELECT organization_id FROM public.users WHERE id = auth.uid()) = organization_id
```

## SUPER_ADMIN (Escencial Consultora)

- No pertenece a ninguna organización
- Accede a `/super-admin` con panel global
- Ve todas las organizaciones, puede crear nuevas
- Su JWT no tiene `organization_id` en claims → no puede crear documentos desde la UI de org

## Corrección de datos huérfanos (SQL)

Si hay registros sin `organization_id`, usar:
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
