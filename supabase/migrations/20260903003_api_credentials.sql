-- API B2B — Fase 1. Credenciales de API por organización.
-- El secret_hash es sha256(secret) hex, no bcrypt: el secreto ya nace de alta entropía
-- (256 bits random generados server-side), así que un hash determinístico indexado
-- alcanza para lookup O(1) sin el costo de bcrypt — mismo patrón que Stripe/GitHub
-- usan para tokens de API (distinto del caso de passwords de baja entropía).

CREATE TABLE IF NOT EXISTS public.api_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_id          TEXT NOT NULL UNIQUE,   -- público, solo para mostrar en panel (ej: "ak_9f2a1c3b")
  secret_hash     TEXT NOT NULL UNIQUE,   -- sha256(secret) hex
  secret_last4    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_credentials_org_idx ON public.api_credentials (organization_id);

ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- Solo SUPER_ADMIN puede leer/gestionar desde el cliente. Las Edge Functions leen
-- con service_role (bypassea RLS) para validar el secret entrante.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_credentials'
      AND policyname = 'superadmin_manage_api_credentials'
  ) THEN
    CREATE POLICY "superadmin_manage_api_credentials" ON public.api_credentials
      FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');
  END IF;
END $$;
