# Edge Functions — Sistema Firma Digital

> Ver también: [[KYC_Flow]] | [[Firma_Flow]]

Todas las edge functions están en `supabase/functions/`. Se despliegan con:
```bash
supabase functions deploy <nombre-funcion>
```

## Funciones desplegadas

### `kyc-create-session`
**Ruta:** `POST /functions/v1/kyc-create-session`  
**Auth:** Bearer token del usuario autenticado  
**Qué hace:**
1. Valida JWT → obtiene `user.id`
2. Lee `organization_id` del JWT payload → fallback a `users` table si ausente
3. Lee `didit_workflow_id` de `organizations`
4. Busca verification PENDING/IN_REVIEW existente → crea si no hay
5. `POST /v3/session/` a DIDIT API con `vendor_data: user.id`
6. Actualiza `identity_verifications` con sesión DIDIT
7. Retorna `{ sessionId, url, token }`

**Variables de entorno requeridas:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DIDIT_API_KEY`, `DIDIT_API_URL`, `DIDIT_WORKFLOW_ID`, `DIDIT_CALLBACK_URL`

---

### `kyc-webhook`
**Ruta:** `GET|POST /functions/v1/kyc-webhook`  
**Auth:** Sin auth (llamada desde DIDIT)

**GET (redirect):** DIDIT redirige al usuario acá después de completar verificación
- Parámetro `?signing=<id>` → modo firma → redirige a `/signing/<id>?face_verified=ok|failed|pending`
- Sin `?signing` → modo KYC normal → redirige a `/kyc/pending` o `/dashboard`

**POST (resultado):** DIDIT llama con el resultado final
- `status: "Approved"` → UPDATE identity_verifications SET status='VERIFIED' + UPDATE users SET verification_status='VERIFIED'
- `status: "Declined"` → REJECTED
- `status: "Processing"` → IN_REVIEW

---

### `face-verify-signing`
**Ruta:** `POST /functions/v1/face-verify-signing`  
**Auth:** Bearer token del usuario  
**Body:** `{ requestId: string }` (signing_request_id)  
**Qué hace:**
1. Busca signature_request → document → organization
2. Lee `didit_workflow_id` de la org
3. Crea `identity_verifications` con `signing_request_id`
4. Crea sesión DIDIT con callback `${DIDIT_CALLBACK_URL}?signing=${requestId}`
5. Retorna `{ sessionId, url }`

---

## Secrets configurados en Supabase

Verificar con:
```bash
supabase secrets list
```

Setear con:
```bash
supabase secrets set DIDIT_API_KEY=xxx
```

## Notas de deploy

- Docker no es necesario para deploy (se usa upload directo)
- `supabase functions logs <nombre>` requiere versión CLI que soporte ese subcomando (verificar)
- Para ver logs: usar Dashboard de Supabase → Functions → Logs
