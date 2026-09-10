# firma-electronica-mcp-server

Servidor MCP (Model Context Protocol) exclusivo para que **Facundo (SUPER_ADMIN, dueño de la plataforma)** opere partes puntuales de Sistema Firma Digital / Firma Electrónica vía IA (Claude Desktop o Claude Code), corriendo **SOLO en su máquina local**.

## Por qué es local-only — NUNCA desplegar

Este servidor usa la `SUPABASE_SERVICE_ROLE_KEY`, que tiene **acceso total** a la base de datos y **bypassea todas las políticas RLS**. No hay capa de autorización propia adentro del servidor: quien pueda ejecutarlo, puede hacer cualquier cosa que permita cualquiera de sus tools, sobre cualquier organización.

Por eso:

- Corre por **transporte stdio**, no HTTP. No escucha ningún puerto, no se expone a internet.
- **Nunca se despliega** en un servidor, contenedor, Vercel, Netlify, ni nada compartido.
- El `.env` con la key real **nunca se commitea** (está en `.gitignore`).
- **No es para empresas clientes.** Las organizaciones clientes se integran exclusivamente por la REST API pública (`supabase/functions/api-*`), con sus propias credenciales `api_credentials` (key_id + secret) y `is_api_enabled`. Este servidor MCP es una herramienta operativa interna, no un canal de la API B2B.

## Instalación

```bash
cd mcp-server
npm install
cp .env.example .env
```

Completá `.env` con las credenciales reales del proyecto Supabase (Project Settings → API):

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Correrlo

En desarrollo (recarga con `tsx`, no requiere build):

```bash
npm run dev
```

Para producción/uso normal (compilado):

```bash
npm run build
npm start
```

El proceso queda esperando llamadas por stdin/stdout — no hace falta (ni tiene sentido) abrirlo directamente en el navegador. Se conecta desde Claude Desktop o Claude Code como se explica abajo.

## Agregarlo a Claude Desktop / Claude Code

### Claude Desktop

Editá el archivo de configuración de MCP de Claude Desktop (`claude_desktop_config.json`) y agregá una entrada bajo `mcpServers`:

```json
{
  "mcpServers": {
    "firma-electronica": {
      "command": "node",
      "args": [
        "C:\\Users\\PERSONAL\\Documents\\PROYECTOS\\PRODUCTOS\\FIRMA DIGITAL\\sistema_firma_digital\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://tu-proyecto.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJ..."
      }
    }
  }
}
```

Requiere haber corrido `npm run build` antes (para que exista `dist/index.js`). Reiniciá Claude Desktop después de guardar la config.

### Claude Code

Con el CLI de Claude Code, desde cualquier carpeta:

```bash
claude mcp add firma-electronica -- node "C:\Users\PERSONAL\Documents\PROYECTOS\PRODUCTOS\FIRMA DIGITAL\sistema_firma_digital\mcp-server\dist\index.js"
```

O agregando manualmente a la config de MCP servers de Claude Code el mismo bloque `command`/`args`/`env` que en el ejemplo de Claude Desktop de arriba.

En ambos casos, en vez de pasar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` por `env` en la config, también podés dejar que el servidor las lea de `mcp-server/.env` (ya soportado vía `dotenv`) — alcanza con no romper el `cwd` desde el que arranca el proceso.

## Tools disponibles

### Organizaciones y API B2B (`src/tools/organizations.ts`)

| Tool | Descripción |
|---|---|
| `list_api_orgs` | Lista las organizaciones con `is_api_enabled=true`, con conteo de credenciales activas y si tienen webhook configurado. |
| `enable_api_for_org` | Activa `is_api_enabled=true` para una organización (por `organizationId` o `slug`). Avisa si no tiene autoridad activa. |
| `disable_api_for_org` | Desactiva `is_api_enabled` para una organización. |
| `get_org_authority_status` | Chequea si la organización tiene una autoridad `PERMANENT` con status `ACTIVE` — precondición antes de habilitar la API. |
| `set_api_template_binding` | Crea o actualiza el binding entre una plantilla de contrato y un `apiSlug` público, para una organización. |
| `list_org_templates_for_api` | Lista las plantillas habilitadas para la API de una organización. |

### Credenciales y solicitudes de firma (`src/tools/credentials.ts`)

| Tool | Descripción |
|---|---|
| `generate_api_credential` | Genera un `key_id`/`secret` nuevo para una organización. El `secret` se muestra **una sola vez**, no queda recuperable después. |
| `revoke_api_credential` | Revoca una credencial de API (`status='REVOKED'`). |
| `list_pending_contracts` | Lista las últimas solicitudes de firma (`signature_requests`) de una organización, con filtro opcional por `status`. |

### Webhooks salientes (`src/tools/webhooks.ts`)

| Tool | Descripción |
|---|---|
| `list_webhook_events` | Lista los últimos eventos de la cola de webhooks salientes de una organización, con filtro opcional por `status`. |
| `retry_webhook_event` | Resetea un evento a `PENDING` para que el próximo dispatch lo reintente — fallback manual si `pg_cron`/`pg_net` no están disponibles en el ambiente local. |

## Estructura

```
mcp-server/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── index.ts              → arma el McpServer, conecta transporte stdio
    ├── supabaseClient.ts     → cliente Supabase con service_role key
    ├── lib/
    │   └── helpers.ts        → formateo de respuestas + resolución de organización
    └── tools/
        ├── organizations.ts
        ├── credentials.ts
        └── webhooks.ts
```
