-- API B2B — Fase 1. Cola de eventos de webhook saliente hacia la empresa cliente
-- (api_webhook_url), con reintento por backoff exponencial. No existe pg_cron/pg_net
-- en el repo hasta esta migración — se habilitan recién en 20260903007, aditivo.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type           TEXT NOT NULL,
  document_id          UUID REFERENCES public.documents(id),
  signature_request_id UUID REFERENCES public.signature_requests(id),
  payload              JSONB NOT NULL,
  status               TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'DEAD')),
  attempts             INTEGER NOT NULL DEFAULT 0,
  max_attempts         INTEGER NOT NULL DEFAULT 8,
  next_attempt_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error           TEXT,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_due_idx ON public.webhook_events (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS webhook_events_org_idx ON public.webhook_events (organization_id);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'webhook_events'
      AND policyname = 'superadmin_read_webhook_events'
  ) THEN
    CREATE POLICY "superadmin_read_webhook_events" ON public.webhook_events
      FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');
  END IF;
END $$;
