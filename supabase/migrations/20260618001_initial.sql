ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS signing_order INTEGER DEFAULT 0;

ALTER TABLE public.identity_verifications
  ADD COLUMN IF NOT EXISTS provider_session_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_session_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_session_token TEXT,
  ADD COLUMN IF NOT EXISTS provider_response JSONB;

DROP FUNCTION IF EXISTS public.get_my_kyc_status;
CREATE OR REPLACE FUNCTION public.get_my_kyc_status()
RETURNS TABLE(id UUID, status TEXT, rejection_reason TEXT, submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT iv.id, iv.status::TEXT, iv.rejection_reason, iv.submitted_at, iv.reviewed_at, iv.created_at
  FROM public.identity_verifications iv
  WHERE iv.user_id = auth.uid()
  ORDER BY iv.created_at DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_kyc_status() TO authenticated;

DROP FUNCTION IF EXISTS public.get_signature_request_by_token;
CREATE OR REPLACE FUNCTION public.get_signature_request_by_token(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object('id', sr.id, 'documentId', sr.document_id, 'signerEmail', sr.signer_email, 'signerName', sr.signer_name, 'status', sr.status, 'acceptedConformity', sr.accepted_conformity, 'expiresAt', sr.expires_at, 'documentTitle', d.title, 'documentDescription', d.description, 'templateId', d.template_id, 'templateFields', d.template_fields, 'pdfUrl', dv.storage_path, 'sha256Hash', dv.sha256_hash, 'fileName', dv.file_name)
  FROM public.signature_requests sr
  JOIN public.documents d ON d.id = sr.document_id
  LEFT JOIN public.document_versions dv ON dv.id = d.current_version_id
  WHERE sr.token = p_token AND sr.expires_at > now()
  INTO v_result;
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token TO anon, authenticated;

DROP FUNCTION IF EXISTS public.view_signature_request;
CREATE OR REPLACE FUNCTION public.view_signature_request(p_token TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.signature_requests SET status = 'VIEWED', viewed_at = COALESCE(viewed_at, now()) WHERE token = p_token AND status = 'PENDING';
  INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata) VALUES ('DOCUMENT_VIEWED', 'signature_request', (SELECT id FROM public.signature_requests WHERE token = p_token), json_build_object('token', p_token));
END; $$;
GRANT EXECUTE ON FUNCTION public.view_signature_request TO anon, authenticated;

DROP FUNCTION IF EXISTS public.accept_conformity_by_token;
CREATE OR REPLACE FUNCTION public.accept_conformity_by_token(p_token TEXT, p_acceptance_text TEXT, p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_sr public.signature_requests;
BEGIN
  SELECT * INTO v_sr FROM public.signature_requests WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud de firma no encontrada'; END IF;
  INSERT INTO public.conformity_acceptances (signature_request_id, acceptance_text, ip_address, user_agent) VALUES (v_sr.id, p_acceptance_text, p_ip_address, p_user_agent);
  UPDATE public.signature_requests SET status = 'CONFORMITY_ACCEPTED', accepted_conformity = true WHERE id = v_sr.id;
  INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata) VALUES ('CONFORMITY_ACCEPTED', 'signature_request', v_sr.id, json_build_object('token', p_token, 'email', v_sr.signer_email));
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_conformity_by_token TO anon, authenticated;

DROP FUNCTION IF EXISTS public.reject_signature_request;
CREATE OR REPLACE FUNCTION public.reject_signature_request(p_token TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.signature_requests SET status = 'REJECTED' WHERE token = p_token AND status NOT IN ('SIGNED', 'REJECTED');
  INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata) VALUES ('DOCUMENT_REJECTED', 'signature_request', (SELECT id FROM public.signature_requests WHERE token = p_token), json_build_object('token', p_token));
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_signature_request TO anon, authenticated;

DROP FUNCTION IF EXISTS public.generate_otp;
CREATE OR REPLACE FUNCTION public.generate_otp(p_signature_request_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_code TEXT; v_hash TEXT;
BEGIN
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  v_hash := crypt(v_code, gen_salt('bf'));
  INSERT INTO public.otp_challenges (signature_request_id, code_hash) VALUES (p_signature_request_id, v_hash);
  RETURN v_code;
END; $$;

DROP FUNCTION IF EXISTS public.verify_otp;
CREATE OR REPLACE FUNCTION public.verify_otp(p_signature_request_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_challenge public.otp_challenges;
BEGIN
  SELECT * INTO v_challenge FROM public.otp_challenges WHERE signature_request_id = p_signature_request_id AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF crypt(p_code, v_challenge.code_hash) = v_challenge.code_hash THEN
    UPDATE public.otp_challenges SET used = true WHERE id = v_challenge.id;
    RETURN true;
  END IF;
  RETURN false;
END; $$;
