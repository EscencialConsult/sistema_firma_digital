# Tareas pendientes — Sistema Firma Digital

## Estado general
La plataforma está funcional de punta a punta. El flujo core (admin crea contrato → firmante recibe email → firma con verificación facial → registro en DB) está implementado y conectado a Supabase. Lo que sigue son mejoras de UX, páginas faltantes y configuraciones de producción.

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
