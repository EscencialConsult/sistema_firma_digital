# Auth Flow — Sistema Firma Digital

> Ver también: [[Arquitectura]] | [[KYC_Flow]]

## Roles

| Rol | Acceso |
|---|---|
| `SUPER_ADMIN` | Todo. Panel `/super-admin`. Cross-org. |
| `ORG_ADMIN` | Panel `/admin`. Su organización. |
| `ADMIN` | Igual que ORG_ADMIN (legacy) |
| `USER` | Dashboard `/dashboard`. Solo sus datos. Necesita KYC. |

## Guards de rutas (en orden de aplicación)

```
AppRouter (espera loading=false)
└── AuthGuard         → si no hay user → /login
    └── KycLayout     → /kyc, /kyc/pending, /kyc/rejected (sin VerifiedGuard)
    └── VerifiedGuard → bloquea según verificationStatus
        ├── PENDING / EXPIRED    → /kyc
        ├── IN_REVIEW            → /kyc/pending
        ├── REJECTED             → /kyc/rejected
        ├── ADMIN/ORG_ADMIN/SUPER_ADMIN → bypass total (no necesitan KYC)
        └── VERIFIED             → Outlet (acceso completo)
            └── AdminGuard       → solo ADMIN/ORG_ADMIN/SUPER_ADMIN → /admin
```

**IMPORTANTE:** Admins/ORG_ADMIN bypassan `VerifiedGuard` completamente. Antes de v0.1.2, admins con `verification_status = PENDING` eran redirigidos a /kyc causando blank page.

## AuthProvider (`app/providers/AuthProvider.tsx`)

- Estado global: `user`, `loading`, `error`
- Inicializa con `supabase.auth.onAuthStateChange` — setea `loading=false` solo en `INITIAL_SESSION`
- Safety timeout: 10s para evitar pantalla en blanco infinita
- `fetchProfile()` → lee `public.users` para obtener rol y verificationStatus
- Fallback si falla DB: `verificationStatus: "PENDING"` (usuario va a /kyc)

## AuthUser type (`shared/types/user.ts`)

```ts
interface AuthUser {
  id: string
  email: string
  fullName: string
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "ADMIN" | "USER"
  verificationStatus: "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED"
  certificateStatus: "NONE" | "ACTIVE" | "EXPIRED"
  organizationId?: string
  termsAcceptedAt?: string
}
```

## Servicios (`shared/services/auth.service.ts`)

| Función | Descripción |
|---|---|
| `login(email, password)` | signInWithPassword + fetchProfile |
| `register(input)` | signUp + retry fetchProfile (trigger lag) |
| `fetchProfile(userId, authUser)` | SELECT de public.users, fallback a metadata |
| `fetchMe()` | getUser + fetchProfile |
| `updateSessionUser(updates)` | UPDATE public.users + re-fetch |
| `logout()` | supabase.auth.signOut |
