-- API B2B — Fase 1. Auditoría + idempotencia de cada llamada a api-contracts-generate.
-- El índice único parcial sobre (organization_id, idempotency_key) es lo que le permite
-- a api-contracts-generate devolver el mismo resultado si la empresa cliente reintenta
-- la misma llamada (idempotency_key es opcional: filas sin ella no colisionan entre sí).

CREATE TABLE IF NOT EXISTS public.api_contract_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_credential_id    UUID REFERENCES public.api_credentials(id),
  idempotency_key      TEXT,
  document_id          UUID REFERENCES public.documents(id),
  signature_request_id UUID REFERENCES public.signature_requests(id),
  request_payload      JSONB,
  status               TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'GENERATED', 'FAILED')),
  error_message        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS api_contract_requests_idem_uq
  ON public.api_contract_requests (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS api_contract_requests_org_idx ON public.api_contract_requests (organization_id);

ALTER TABLE public.api_contract_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_contract_requests'
      AND policyname = 'superadmin_read_api_contract_requests'
  ) THEN
    CREATE POLICY "superadmin_read_api_contract_requests" ON public.api_contract_requests
      FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');
  END IF;
END $$;
