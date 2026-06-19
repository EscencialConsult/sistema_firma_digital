-- Vincula una autoridad provisional con su documento de convenio
ALTER TABLE public.organization_authorities
  ADD COLUMN IF NOT EXISTS document_id        UUID REFERENCES public.documents(id),
  ADD COLUMN IF NOT EXISTS signing_request_id UUID REFERENCES public.signature_requests(id);

-- Función pública: obtener el signing_request_id de una autoridad por token
-- (para que la página de aceptación provisional redirija al flujo de firma)
CREATE OR REPLACE FUNCTION public.get_authority_signing_request(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'authority_id',       a.id,
    'type',               a.type,
    'status',             a.status,
    'signing_request_id', a.signing_request_id,
    'document_id',        a.document_id
  ) INTO v_result
  FROM public.organization_authorities a
  WHERE a.invite_token = p_token;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_authority_signing_request(TEXT) TO anon, authenticated;
