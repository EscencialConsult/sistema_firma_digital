-- ─── Trigger: activar autoridad provisional cuando firma el convenio ──────────
--
-- Cuando signature_requests.status cambia a 'SIGNED', verifica si ese
-- signing_request está vinculado a una autoridad provisional en
-- organization_authorities.signing_request_id, y si es así la marca ACTIVE.

CREATE OR REPLACE FUNCTION public.activate_provisional_authority_on_sign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'SIGNED' AND OLD.status IS DISTINCT FROM 'SIGNED' THEN
    UPDATE public.organization_authorities
    SET
      status      = 'ACTIVE',
      accepted_at = now(),
      updated_at  = now()
    WHERE
      signing_request_id = NEW.id
      AND type            = 'PROVISIONAL'
      AND status          = 'PENDING';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_activate_provisional_authority ON public.signature_requests;

CREATE TRIGGER trigger_activate_provisional_authority
  AFTER UPDATE ON public.signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_provisional_authority_on_sign();
