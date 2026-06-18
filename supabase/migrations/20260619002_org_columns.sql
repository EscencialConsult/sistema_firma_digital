-- ============================================================================
-- 1. ADD COLUMN organization_id
-- ============================================================================

ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.signature_requests 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.identity_verifications 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- La tabla certificates no existe aun, se omitira por ahora
-- ALTER TABLE public.certificates 
--   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_documents_org_created 
  ON public.documents(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sigreq_org_created 
  ON public.signature_requests(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_idverif_org_created 
  ON public.identity_verifications(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditlogs_org_created 
  ON public.audit_logs(organization_id, created_at DESC);

-- CREATE INDEX IF NOT EXISTS idx_certificates_org_created 
--   ON public.certificates(organization_id, created_at DESC);

-- ============================================================================
-- 3. TRIGGER: fn_propagate_org
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_propagate_org()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Si ya viene con organization_id, lo respetamos
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Intentamos sacar el organization_id del usuario logueado
  SELECT organization_id INTO v_org_id 
  FROM public.users 
  WHERE id = auth.uid();

  -- Si el usuario tiene una organizacion, la asignamos al nuevo registro
  IF v_org_id IS NOT NULL THEN
    NEW.organization_id := v_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar el trigger a documents
DROP TRIGGER IF EXISTS trigger_propagate_org_documents ON public.documents;
CREATE TRIGGER trigger_propagate_org_documents
BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE PROCEDURE public.fn_propagate_org();

-- Aplicar el trigger a identity_verifications
DROP TRIGGER IF EXISTS trigger_propagate_org_identity_verifications ON public.identity_verifications;
CREATE TRIGGER trigger_propagate_org_identity_verifications
BEFORE INSERT ON public.identity_verifications
FOR EACH ROW EXECUTE PROCEDURE public.fn_propagate_org();
