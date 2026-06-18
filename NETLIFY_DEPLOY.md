# Deploy en Netlify

## Configuracion del sitio

El repo ya incluye `netlify.toml` en la raiz.

- Base directory: `web-portal`
- Build command: `npm ci && npm run build`
- Publish directory: `web-portal/dist`

Si Netlify lee el `netlify.toml`, estos valores se aplican automaticamente.

## Variables de entorno

En Netlify, ir a **Site configuration > Environment variables** y cargar:

```env
VITE_APP_NAME=Firma Digital - Escencial
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

Opcional, solo si publicas un agente HTTPS propio para firma con token/PKCS#11:

```env
VITE_AGENT_BASE_URL=https://tu-agente.example.com
```

Si no usas agente publicado, no configures `VITE_AGENT_BASE_URL`; el navegador no puede llamar a `127.0.0.1` desde un sitio en Netlify salvo que el usuario ejecute un agente local y el flujo este pensado para eso.

## Supabase

La app usa Supabase directo desde el frontend y Edge Functions. Antes de deployar, verificar:

- Las tablas, funciones y policies estan aplicadas en Supabase.
- Las Edge Functions necesarias estan deployadas: `upload-document`, `send-document`, `sign-document`, `generate-certificate`, y las de KYC/email que uses.
- En Supabase Auth, agregar la URL de Netlify en:
  - Site URL
  - Redirect URLs

Ejemplos:

```text
https://tu-sitio.netlify.app
https://tu-dominio.com
```

## Comandos locales de verificacion

Desde `web-portal`:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

El deploy queda listo cuando `npm run build` genera `web-portal/dist`.
