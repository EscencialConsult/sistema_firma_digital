-- API B2B — Fase 1. Qué contract_templates quedan habilitados para generación vía API,
-- por organización, con un slug estable que la empresa cliente usa en el payload
-- (para no exponerle el UUID interno del template como contrato de API).

CREATE TABLE IF NOT EXISTS public.api_template_bindings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_template_id  UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  api_slug              TEXT NOT NULL,
  is_enabled            BOOLEAN NOT NULL DEFAULT true,
  enabled_by            UUID REFERENCES public.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, api_slug)
);

CREATE INDEX IF NOT EXISTS api_template_bindings_org_idx ON public.api_template_bindings (organization_id);

ALTER TABLE public.api_template_bindings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_template_bindings'
      AND policyname = 'superadmin_manage_api_template_bindings'
  ) THEN
    CREATE POLICY "superadmin_manage_api_template_bindings" ON public.api_template_bindings
      FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');
  END IF;
END $$;
