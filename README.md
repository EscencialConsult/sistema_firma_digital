# Firma Digital Portal

Portal SaaS para firma, conformidad, gestion documental e identidad digital.

## Estructura

```text
web-backend/  API Node.js + Express + TypeScript + PostgreSQL
web-portal/   Frontend React + Vite + TypeScript + Tailwind CSS
docs/         Documentacion tecnica
```

## Requisitos locales

- Node.js 22+
- npm
- Docker Desktop o PostgreSQL local

## Levantar local

Forma recomendada desde la raiz:

```powershell
npm run dev
```

Esto levanta PostgreSQL, ejecuta migraciones/seed, inicia el backend y abre el portal en modo desarrollo.

Verificacion rapida:

```powershell
npm run check
```

Apagar procesos locales de la app:

```powershell
npm run stop
```

Credenciales admin:

```text
admin@example.com
Admin123456
```

Logs generados:

```text
tmp-backend-out.log
tmp-backend-err.log
tmp-portal-out.log
tmp-portal-err.log
```

### Arranque manual

Backend:

```powershell
cd web-backend
npm install
copy .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend:

```powershell
cd web-portal
npm install
copy .env.example .env
npm run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Healthcheck: `http://localhost:4000/health`
- PostgreSQL local del proyecto: `127.0.0.1:5436`

Admin seed:

```text
admin@example.com
Admin123456
```

## Firma con token / certificado Windows

Para desarrollo local, el backend queda preparado para detectar:

- Certificados del store de Windows, incluido el token que Windows ve con clave privada.
- OpenSC/PKCS#11 si el hardware es compatible con `opensc-pkcs11.dll`.
- pyHanko desde `web-backend/.venv-pyhanko` para el camino PKCS#11 cuando aplique.

Variables relevantes en `web-backend/.env`:

```text
PKCS11_TOOL_PATH="C:/Program Files/OpenSC Project/OpenSC/tools/pkcs11-tool.exe"
PKCS11_MODULE_PATH="C:/Program Files/OpenSC Project/OpenSC/pkcs11/opensc-pkcs11.dll"
PKCS11_CERT_ID=
PYHANKO_PYTHON_PATH="C:/Users/santi/Desktop/Escencial/firmaDigital/web-backend/.venv-pyhanko/Scripts/python.exe"
```

El caso del token que ya probamos funciona por el store de Windows, asi que no requiere que OpenSC reconozca perfecto el hardware.

## Docker full stack

Desde la raiz:

```powershell
docker compose up --build
```

Esto levanta PostgreSQL, backend con migraciones/seed y frontend en preview.

## Scripts

Backend:

```powershell
npm run dev
npm run build
npm start
npm run db:migrate
npm run db:seed
npm run db:reset
npm run typecheck
npm run lint
```

Frontend:

```powershell
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
```

## Variables

Backend: [web-backend/.env.example](./web-backend/.env.example)

Frontend: [web-portal/.env.example](./web-portal/.env.example)

En produccion cambia siempre:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `APP_URL`
- `API_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Pruebas manuales

Login admin:

```powershell
Invoke-RestMethod -Method Post http://localhost:4000/api/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"Admin123456"}'
```

Validacion de identidad:

1. Login o registro.
2. `POST /api/identity/start`.
3. `PATCH /api/identity/personal-data`.
4. Uploads multipart:
   - `POST /api/identity/upload-document-front`
   - `POST /api/identity/upload-document-back`
   - `POST /api/identity/upload-selfie`
5. `POST /api/identity/submit`.
6. Admin aprueba o rechaza:
   - `POST /api/admin/identity-verifications/:id/approve`
   - `POST /api/admin/identity-verifications/:id/reject`

Documentos y firma:

1. `POST /api/documents` con multipart `file` y `title`.
2. `POST /api/documents/:id/send`.
3. Abrir `GET /api/signature-requests/:token`.
4. `POST /api/signature-requests/:token/view`.
5. `POST /api/signature-requests/:token/sign` o `reject`.
6. `GET /api/documents/:id/audit`.
7. `GET /api/documents/:id/download`.

## Deploy Render/Railway

Backend:

1. Crear PostgreSQL administrado.
2. Crear servicio Node desde `web-backend`.
3. Build command: `npm ci && npm run build`.
4. Start command: `npm run db:migrate && npm run db:seed && npm start`.
5. Configurar variables de `web-backend/.env.example`.
6. Configurar `CORS_ORIGIN` con la URL real del frontend.
7. Montar volumen persistente para `UPLOADS_DIR` si la plataforma lo soporta. Si no, migrar uploads a S3 o storage compatible.

Frontend:

1. Crear servicio static/Vite desde `web-portal`.
2. Build command: `npm ci && npm run build`.
3. Publish directory: `dist`.
4. Configurar `VITE_API_URL=https://tu-api/api`.

## Seguridad checklist

- Helmet activo.
- CORS restringido por env.
- Rate limiting global.
- Passwords con bcrypt.
- Refresh tokens hasheados y revocables.
- JWT secretos por env.
- Zod en entradas principales.
- Uploads privados.
- Validacion MIME y tamaño.
- UUIDs en entidades.
- Roles `USER`, `ADMIN`, `ORGANIZATION_ADMIN`.
- Admin-only para revision de identidad.
- Mappers evitan exponer paths privados.
- `.env` ignorado.

## Proximos pasos

- Sustituir storage local por S3/R2/MinIO.
- Agregar migraciones versionadas reales con tabla `schema_migrations`.
- Conectar todas las pantallas a datos reales.
- Agregar tests de API.
- Integrar firma PDF real y proveedor KYC externo.
