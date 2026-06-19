-- ─── Tabla: organization_authorities ─────────────────────────────────────────
-- Almacena las autoridades firmantes de cada organización.
-- Tipo PERMANENT: habilitada indefinidamente (ej: presidente de la empresa).
-- Tipo PROVISIONAL: habilitada para un convenio puntual (ej: representante externo).

CREATE TABLE IF NOT EXISTS public.organization_authorities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(id),         -- si tiene cuenta en el sistema
  full_name       TEXT NOT NULL,
  cuil            TEXT,
  cuit            TEXT,
  email           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('PERMANENT', 'PROVISIONAL')),
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED')),
  signature_url   TEXT,                                      -- URL de la imagen de firma en storage
  authorized_by   UUID REFERENCES public.users(id),         -- admin que lo solicitó
  notes           TEXT,
  invited_at      TIMESTAMPTZ DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_authorities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trigger_authorities_updated_at ON public.organization_authorities;
CREATE TRIGGER trigger_authorities_updated_at
BEFORE UPDATE ON public.organization_authorities
FOR EACH ROW EXECUTE FUNCTION public.set_authorities_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_authorities ENABLE ROW LEVEL SECURITY;

-- SUPER_ADMIN: ve todo
CREATE POLICY "SUPER_ADMIN select authorities"
ON public.organization_authorities FOR SELECT
TO authenticated
USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "SUPER_ADMIN insert authorities"
ON public.organization_authorities FOR INSERT
TO authenticated
WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "SUPER_ADMIN update authorities"
ON public.organization_authorities FOR UPDATE
TO authenticated
USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');

-- ORG_ADMIN: ve y gestiona las de su organización
CREATE POLICY "ORG_ADMIN manage own authorities"
ON public.organization_authorities FOR ALL
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
  AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'ORG_ADMIN'
)
WITH CHECK (
  organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
  AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'ORG_ADMIN'
);

-- La autoridad puede ver su propia entrada (por email)
CREATE POLICY "Authority can view own entry"
ON public.organization_authorities FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM public.users WHERE id = auth.uid())
);

-- La autoridad puede actualizar su propia entrada (para cargar firma)
CREATE POLICY "Authority can update own entry"
ON public.organization_authorities FOR UPDATE
TO authenticated
USING (email = (SELECT email FROM public.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM public.users WHERE id = auth.uid()));

-- ─── Storage: bucket authority-signatures ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('authority-signatures', 'authority-signatures', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload authority signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'authority-signatures'
  AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ORG_ADMIN')
);

CREATE POLICY "Authority can upload own signature"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'authority-signatures');

CREATE POLICY "Public can view authority signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'authority-signatures');

CREATE POLICY "Admins can update authority signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'authority-signatures')
WITH CHECK (bucket_id = 'authority-signatures');
