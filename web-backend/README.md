# Firma Digital Web Backend

API Node.js + Express + PostgreSQL para el portal de firma, conformidad y gestion documental.

## Comandos

```powershell
npm install
copy .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

La API corre por defecto en `http://127.0.0.1:8000`.

## Modulos

- `auth`: registro, login, logout y refresh tokens.
- `users`: perfil del usuario autenticado.
- `identity`: flujo de verificacion de identidad.
- `certificates`: metadata de certificados digitales.
- `documents`: carga, estados y descarga de PDFs.
- `signatureRequests`: links seguros para firmantes.
- `signatures`: flujo de firma preparado para integracion real.
- `conformity`: aceptacion/conformidad con trazabilidad.
- `audit`: bitacora legal de eventos.
- `notifications`: cola de notificaciones.
- `admin`: vistas administrativas.

