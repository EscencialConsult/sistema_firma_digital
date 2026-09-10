-- API B2B — Fase 1. Reintento programado de webhook_events, cada minuto.
-- pg_cron / pg_net son extensiones estándar que Supabase trae disponibles tanto en
-- hosted como (en versiones recientes de la CLI) en la imagen local — habilitarlas acá
-- es aditivo, no reemplaza el intento inmediato fire-and-forget que hace
-- dispatch-webhook al insertarse el evento (mismo patrón que ya usa el frontend con
-- send-signing-email). Este cron es la red de seguridad para reintentos con backoff.
--
-- FASE 0 — validar antes de aplicar: si "CREATE EXTENSION pg_cron" falla en el
-- ambiente local (imagen sin la extensión compilada), NO aplicar esta migración ahí;
-- el sistema sigue funcionando solo con el intento inmediato + el tool de MCP
-- retry_webhook_event como respaldo manual durante desarrollo. Aplicar en hosted
-- (donde Supabase sí la trae) recién al desplegar, con aprobación explícita.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Los settings de sesión (URL de la función + secreto interno) los define el operador
-- por ambiente (SQL Editor / migración de config posterior) — no se hardcodean acá:
--   ALTER DATABASE postgres SET app.settings.dispatch_webhook_url = '...';
--   ALTER DATABASE postgres SET app.settings.dispatch_internal_secret = '...';
-- Si no están seteados, el job corre pero net.http_post falla silenciosamente
-- (queda logueado en cron.job_run_details) sin afectar el resto del sistema.

SELECT cron.schedule(
  'dispatch-webhook-events',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.dispatch_webhook_url', true),
    headers := jsonb_build_object(
                 'content-type', 'application/json',
                 'x-internal-secret', current_setting('app.settings.dispatch_internal_secret', true)
               ),
    body    := '{}'::jsonb
  )
  WHERE current_setting('app.settings.dispatch_webhook_url', true) IS NOT NULL;
  $$
);
