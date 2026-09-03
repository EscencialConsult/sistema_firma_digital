# Auth Flow — Sistema Firma Digital

> Ver también: [[Arquitectura]] | [[KYC_Flow]] | [[Organizaciones]]

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
└── AuthGuard         → si no hay user → lee lastOrgSlug → /${slug} o /login
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
- Inicializa con `supabase.auth.getSession()` de forma síncrona, luego escucha `onAuthStateChange`
- `fetchProfile()` → lee `public.users` + `organization_memberships` para obtener rol, verificationStatus, memberOrgIds
- Fallback si falla DB: construye perfil mínimo desde `auth.user_metadata`

## AuthUser type (`shared/types/user.ts`)

```ts
interface AuthUser {
  id: string
  email: string
  fullName: string
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "ADMIN" | "USER"
  verificationStatus: "PENDING" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED"
  certificateStatus: "NONE" | "ACTIVE" | "EXPIRED"
  organizationId?: string      // org primaria
  memberOrgIds: string[]       // todas las orgs activas (incluye primaria)
  isMultiOrg: boolean          // memberOrgIds.length > 1
  termsAcceptedAt?: string
}
```

## Servicios (`shared/services/auth.service.ts`)

| Función | Descripción |
|---|---|
| `login(email, password)` | signInWithPassword + fetchProfile |
| `register(input)` | signUp + retry fetchProfile (trigger lag) |
| `fetchProfile(userId, authUser)` | SELECT de public.users + memberships, fallback a metadata |
| `fetchMe()` | getUser + fetchProfile |
| `logout()` | supabase.auth.signOut |
| `resendConfirmationEmail(email)` | supabase.auth.resend type=signup |
| `updateSessionUser(updates)` | UPDATE public.users + re-fetch |

## Sistema lastOrgSlug (redirect post-logout)

`cacheOrgSlug()` en AuthProvider guarda el slug de la org del usuario en `localStorage("lastOrgSlug")` cada vez que se resuelve el perfil. `AuthGuard` lo lee cuando `user === null` para saber a dónde redirigir.

**Lógica de logout (v0.2.2+):**

```typescript
// AuthProvider.logout()
logout() {
  if (!user || user.isMultiOrg) localStorage.removeItem("lastOrgSlug");
  void logoutService();
  setUser(null);
}
```

| Caso | Resultado |
|---|---|
| Usuario con 1 org | Conserva slug → `AuthGuard` redirige a `/${slug}` |
| Usuario con +1 org | Limpia slug → `AuthGuard` redirige a `/login` (portal neutro) |

**Archivo clave:** `app/guards/AuthGuard.tsx` línea 14-15.

## Login desde portal de org (`JoinOrgPage`)

`/:slug` muestra el formulario de login/registro brandeado con los colores de la org.

**Flujo post-login (v0.2.3+):**
1. `handleLogin` hace login pero NO navega inmediatamente
2. `useEffect` de membresía llama `getMembershipForOrg(org.id)`
3. Segundo `useEffect` evalúa el resultado:
   - `membership.status === "active"` → `navigate("/dashboard")`
   - `membership` pendiente → muestra estado "Solicitud en revisión"
   - Sin membresía → muestra estado "Acceso restringido" (solicitar acceso o pedir link de invitación)

Esto evita que usuarios con credenciales válidas pero sin membresía en esa org accedan al dashboard.

## Configuración Supabase necesaria

- Email provider: debe estar **activo** en Authentication → Sign In / Providers → Email
- Site URL: debe apuntar a producción (`https://laws.escencialconsultora.com`), no localhost
- Sin esto, los emails de confirmación y reset redirigen mal o no funcionan
