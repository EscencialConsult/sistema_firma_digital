# KYC Flow — Sistema Firma Digital

> Ver también: [[Auth_Flow]] | [[Edge_Functions]]

## Flujo completo

```
Usuario → /kyc (KycWizardPage)
  Step 0: Datos personales → guarda en identity_verifications
  Step 1: Términos y condiciones → guarda terms_accepted_at
  Step 2: DIDIT redirect
    → edge fn kyc-create-session crea sesión DIDIT
    → usuario es redirigido a verify.didit.me
    → DIDIT llama al webhook (kyc-webhook) cuando termina
    → webhook actualiza identity_verifications.status
    → realtime subscription en KycWizardPage detecta cambio
  Step 3: Revisión final (solo si VERIFIED inmediato)

DIDIT status → nuestro status:
  Approved  → VERIFIED  → /dashboard
  Declined  → REJECTED  → /kyc/rejected
  Abandoned → (webhook no dispara status final, queda PENDING)
  Processing → IN_REVIEW → /kyc/pending
```

## Estados de identity_verifications

| Status | Qué significa |
|---|---|
| `PENDING` | Sesión DIDIT creada pero no completada |
| `IN_REVIEW` | DIDIT recibió docs, revisando manualmente |
| `VERIFIED` | Aprobado — usuario puede acceder al sistema |
| `REJECTED` | Rechazado — usuario va a /kyc/rejected |
| `EXPIRED` | Sesión caducó — volver a iniciar |

## Edge Functions involucradas

### `kyc-create-session`
- **Trigger:** Step 2 de KycWizardPage (via kycService.startProviderVerification)
- Lee `organization_id` del JWT → fallback a `users` table si no está en claims
- Lee `didit_workflow_id` de la organización
- Crea/reutiliza registro en `identity_verifications` (busca PENDING/IN_REVIEW primero)
- Llama DIDIT v3 API: `POST /v3/session/`
- Guarda `provider_session_id`, `provider_session_url`, `provider_session_token`

### `kyc-webhook`
- **Trigger:** DIDIT llama en GET (redirect) y POST (resultado final)
- GET: redirige al usuario de vuelta a la app después de DIDIT
  - Si tiene `?signing=<id>` → redirige a `/signing/<id>?face_verified=ok|failed|pending`
  - Sin signing → redirige a `/kyc/pending` o `/dashboard`
- POST: actualiza `identity_verifications.status` + `users.verification_status`

### `face-verify-signing` (firma)
- **Trigger:** Paso de verificación facial en SigningFlowPage
- Acepta `requestId` (signing_request_id)
- Crea sesión DIDIT con callback `?signing=<requestId>`
- Retorna `{ sessionId, url }` para redirigir al usuario

## Problemas conocidos / Gotchas

1. **JWT sin organization_id:** Si el usuario inició sesión antes del hook de claims, el JWT no tiene `organization_id`. Siempre hacer fallback a `SELECT organization_id FROM users WHERE id = user.id`.

2. **Sesión DIDIT trabada:** Si el usuario abandona DIDIT a mitad (ej. no escaneó el dorso del DNI), la sesión queda PENDING en nuestra DB pero eliminada en DIDIT. Fix: desde `/kyc/pending` hay un botón "Reiniciar verificación" que limpia `provider_session_*` y resetea status a PENDING.

3. **Código de barras DNI:** La Cédula de Identidad argentina puede fallar en DIDIT si la foto del dorso no es clara. La Licencia de conducir funciona mejor. DIDIT muestra "Código de barras no detectado" como warning.

4. **IN_REVIEW no da acceso:** Desde v0.1.2, `IN_REVIEW` redirige a `/kyc/pending`, NO al dashboard. Solo `VERIFIED` da acceso.

## Reiniciar KYC manualmente (SQL)

```sql
UPDATE public.users 
SET verification_status = 'PENDING'
WHERE email = 'usuario@ejemplo.com';

UPDATE public.identity_verifications 
SET status = 'PENDING',
    provider_session_id = null,
    provider_session_url = null,
    provider_session_token = null
WHERE user_id = (SELECT id FROM public.users WHERE email = 'usuario@ejemplo.com');
```
