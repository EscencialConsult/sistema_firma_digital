-- API B2B — Fase 1 (esquema aditivo). Flags de habilitación de API por organización.
-- Aditivo puro: columnas nuevas con default seguro, no toca ninguna columna existente.
-- is_api_enabled solo lo puede prender SUPER_ADMIN desde el panel — no es self-service
-- (ver docs/obsidian/wiki y memoria de proyecto "API Conector B2B").

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_api_enabled     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS api_webhook_url    TEXT,
  ADD COLUMN IF NOT EXISTS api_webhook_secret TEXT;

COMMENT ON COLUMN public.organizations.is_api_enabled IS
  'Habilitado exclusivamente por SUPER_ADMIN. No exponer toggle self-service a ORG_ADMIN.';
COMMENT ON COLUMN public.organizations.api_webhook_secret IS
  'Secreto HMAC-SHA256 para firmar webhooks salientes (mismo patrón que kyc-webhook). Nunca exponer en SELECT a roles no-SUPER_ADMIN.';
