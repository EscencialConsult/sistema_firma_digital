-- Reconcilia el esquema de contract_templates en el flujo de migraciones versionado.
-- La tabla existe hoy en producción (se referencia y se altera en 20260710002,
-- 20260716002 y 20260716003) pero su CREATE TABLE original nunca quedó versionado
-- en este repo (drift confirmado: cero resultados de "contract_templates" en
-- supabase/schema.sql). Esta migración es puramente reparadora: CREATE TABLE IF NOT
-- EXISTS con el esquema real (derivado de web-portal/src/shared/services/
-- contractTemplates.service.ts, que es la única fuente de verdad viva del esquema).
-- No cambia nada en un ambiente donde la tabla ya existe.

CREATE TABLE IF NOT EXISTS public.contract_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  label             TEXT NOT NULL DEFAULT '',
  logo_header       BOOLEAN NOT NULL DEFAULT false,
  logo_watermark    BOOLEAN NOT NULL DEFAULT false,
  content_html      TEXT NOT NULL DEFAULT '',
  signature_position JSONB NOT NULL DEFAULT '{"page":"last","x":50,"y":50,"width":80,"height":30}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Columnas agregadas por migraciones posteriores (20260716002, 20260716003) —
-- IF NOT EXISTS para no pisar el estado real si ya están aplicadas.
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS version_minor  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS template_type  TEXT NOT NULL DEFAULT 'html' CHECK (template_type IN ('html', 'pdf')),
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contract_templates'
      AND policyname = 'org_manage_own_contract_templates'
  ) THEN
    CREATE POLICY "org_manage_own_contract_templates" ON public.contract_templates
      FOR ALL USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
        OR organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
      );
  END IF;
END $$;
