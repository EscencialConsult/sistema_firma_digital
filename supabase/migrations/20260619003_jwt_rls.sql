-- ============================================================================
-- 1. JWT Custom Access Token Hook
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_org_id text;
  claims jsonb;
BEGIN
  -- Leer los datos de la tabla users
  SELECT role::text, organization_id::text 
  INTO v_role, v_org_id 
  FROM public.users 
  WHERE id = (event->>'user_id')::uuid;

  -- Tomar los claims actuales
  claims := event->'claims';
  
  -- Inyectar user_role
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  END IF;
  
  -- Inyectar organization_id
  IF v_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(v_org_id));
  END IF;

  -- Retornar el evento modificado
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Permisos estrictos para el hook
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- ============================================================================
-- 2. RLS Policies basadas en JWT
-- ============================================================================

-- Habilitar RLS en las tablas (por si no lo estaban)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- documents
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizacion access for documents" ON public.documents;
CREATE POLICY "Organizacion access for documents"
ON public.documents
FOR ALL
USING (
  (auth.jwt() ->> 'user_role' = 'SUPER_ADMIN') OR
  (organization_id::text = auth.jwt() ->> 'organization_id')
);

-- ----------------------------------------------------------------------------
-- identity_verifications
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizacion access for identity_verifications" ON public.identity_verifications;
CREATE POLICY "Organizacion access for identity_verifications"
ON public.identity_verifications
FOR ALL
USING (
  (auth.jwt() ->> 'user_role' = 'SUPER_ADMIN') OR
  (organization_id::text = auth.jwt() ->> 'organization_id') OR
  (user_id = auth.uid()) -- El propio usuario siempre puede ver/crear sus verifications
);

-- ----------------------------------------------------------------------------
-- signature_requests
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizacion access for signature_requests" ON public.signature_requests;
CREATE POLICY "Organizacion access for signature_requests"
ON public.signature_requests
FOR ALL
USING (
  (auth.jwt() ->> 'user_role' = 'SUPER_ADMIN') OR
  (organization_id::text = auth.jwt() ->> 'organization_id') OR
  -- Permitir lectura publica temporal si se accede por token para firmantes externos (asumiendo RLS especifico despues)
  -- Para mantenerlo estricto al pedido:
  (auth.uid() IS NOT NULL AND organization_id::text = auth.jwt() ->> 'organization_id')
);

-- ----------------------------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizacion access for audit_logs" ON public.audit_logs;
CREATE POLICY "Organizacion access for audit_logs"
ON public.audit_logs
FOR ALL
USING (
  (auth.jwt() ->> 'user_role' = 'SUPER_ADMIN') OR
  (organization_id::text = auth.jwt() ->> 'organization_id')
);
