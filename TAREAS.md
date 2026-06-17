# Tareas pendientes — Sistema Firma Digital

## Estado general
La plataforma está funcional de punta a punta. El flujo core (admin crea contrato → firmante recibe email → firma con verificación facial → registro en DB) está implementado y conectado a Supabase. Lo que sigue son mejoras de UX, páginas faltantes y configuraciones de producción.

---

## Prioridad alta

### 1. Páginas vacías (están en el router pero sin contenido real)
- `/certificates` — CertificatesPage: lista de certificados de firma emitidos al usuario
- `/conformity` — ConformityPage: detalle de la declaración de conformidad firmada
- `/identity` — IdentityPage: estado del proceso KYC del usuario (alternativa al perfil)

### 2. Manejo de estados del signing flow
- Cuando `/signing/:id` tiene status `EXPIRED` → mostrar página de error clara ("Este enlace venció")
- Cuando status es `REJECTED` → mostrar estado con motivo
- Cuando status es `SIGNED` → mostrar que ya fue firmado, no permitir refirmar

### 3. Favicon
- `web-portal/public/favicon.ico` no existe → 404 en cada carga
- Crear o copiar un ícono simple de escudo/firma

---

## Prioridad media

### 4. Print CSS para exportar contratos como PDF
- Archivo: `web-portal/src/features/signing/SigningFlowPage.tsx`
- El botón "Imprimir / PDF" ya existe (llama a `window.print()`)
- Falta agregar `@media print` en el CSS: ocultar sidebar, header, pasos, botones — mostrar solo el ContractDocument
- Agregar en `web-portal/src/index.css`

### 5. AdminKycReviewPage — ver imágenes de DNI y selfie
- Archivo: `web-portal/src/features/admin/AdminKycReviewPage.tsx`
- Actualmente muestra los datos pero no renderiza las fotos subidas
- Conectar `mapRowToVerification()` de kyc.service.ts que genera signed URLs de Supabase Storage
- Mostrar `<img src={doc.signedUrl} />` para DNI frente, DNI dorso y selfie

### 6. Feedback visual en errores de login
- Actualmente el error `{}` se muestra como una caja roja con `{}` (el objeto serializado)
- Mejorar en `web-portal/src/features/auth/LoginPage.tsx` para mostrar mensajes legibles:
  - "Credenciales incorrectas" para 400
  - "Error del servidor, intentá más tarde" para 500

---

## Prioridad baja

### 7. DashboardPage — widgets con data real
- Archivo: `web-portal/src/features/dashboard/DashboardPage.tsx`
- Ya usa `getMyContracts()` y `getMySigningRequests()` de Supabase
- Verificar que los contadores de contratos pendientes/firmados sean correctos

### 8. AuditPage admin — vista para admins
- Actualmente `AuditPage` solo muestra los eventos del usuario logueado
- Para el admin debería mostrar todos los eventos del sistema (usar `getAllAuditEvents()`)
- Detectar si `user.role === 'ADMIN'` y llamar la función correcta

### 9. Notificación de éxito al crear contratos
- En `AdminContractsPage`, cuando se crea el contrato exitosamente el `SuccessStep` aparece
- Falta un toast/snackbar o animación más clara de confirmación

### 10. Foto de perfil (avatar)
- ProfilePage no tiene subida de foto de perfil
- Bucket `kyc-documents` ya existe — se podría usar `avatars/` como subfolder

---

## Infraestructura pendiente

### Deploy a producción
- Subir el frontend a Vercel (conectar repo GitHub → rama `codex-p0-production-hardening`)
- Actualizar secret de Supabase: `supabase secrets set APP_URL=https://tu-dominio.vercel.app`
- Configurar en Supabase Dashboard → Auth → URL Configuration → Site URL y Redirect URLs

### Deploy de Edge Functions (ya desarrolladas, falta configurar)
```bash
supabase functions deploy face-verify
supabase functions deploy send-signing-email
supabase functions deploy admin-create-user
```

### Storage buckets (ya creados con storage_setup.sql)
- Verificar que las políticas RLS de storage estén aplicadas
- Testear subida de documentos KYC desde el wizard

### AWS Rekognition (en producción)
- Keys ya configuradas como secrets en Supabase
- La Edge Function `face-verify` tiene fallback mock si falla
- Testear con foto real de DNI vs selfie para validar el threshold del 90%

### Email (Resend)
- `send-signing-email` deployada y configurada con `RESEND_API_KEY`
- `FROM_EMAIL` actualmente usa `onboarding@resend.dev` (dominio de prueba de Resend)
- Para producción: verificar un dominio propio en resend.com y actualizar el secret

---

## Credenciales a rotar (expuestas en el chat de desarrollo)
- Supabase CLI token: `sbp_736c...` → rotar en dashboard.supabase.com/account/tokens
- AWS Access Key: `AKIAZV5OVGDY42D273TO` → rotar en IAM → usuario → Credenciales de seguridad
- Resend API Key: `re_5vhNVZ5y...` → rotar en resend.com → API Keys
- Service Role Key de Supabase: fue expuesta en terminal → rotar en Dashboard → Settings → API

---

## Flujo completo verificado
- Login / registro con Supabase Auth
- KYC wizard (subida de documentos)
- Panel admin: dashboard, usuarios, KYC, contratos, auditoría
- Crear contrato desde template → asignar firmante → email de notificación
- Flujo de firma: conformidad → verificación facial → firma canvas → confirmación
- Registro de firma en Supabase (signatures + audit_logs)
