-- Create real notifications when a signature request is completed.
-- This runs in the database so it works for portal signing, public links and Edge Functions.

CREATE OR REPLACE FUNCTION public.notify_signature_request_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_title TEXT;
  v_doc_owner UUID;
  v_org_id UUID;
  v_signer_name TEXT;
BEGIN
  IF NEW.status = 'SIGNED' AND OLD.status IS DISTINCT FROM 'SIGNED' THEN
    SELECT d.title, d.owner_id, d.organization_id
    INTO v_doc_title, v_doc_owner, v_org_id
    FROM public.documents d
    WHERE d.id = NEW.document_id;

    v_doc_title := COALESCE(v_doc_title, 'Documento');
    v_org_id := COALESCE(NEW.organization_id, v_org_id);
    v_signer_name := COALESCE(NULLIF(NEW.signer_name, ''), NULLIF(NEW.signer_email, ''), 'Un firmante');

    -- Notify organization admins and super admins.
    INSERT INTO public.notifications (user_id, title, description, type, read, link)
    SELECT DISTINCT
      u.id,
      'Documento firmado',
      v_signer_name || ' firmo "' || v_doc_title || '".',
      'success',
      false,
      '/admin/contracts'
    FROM public.users u
    WHERE
      u.id IS NOT NULL
      AND (
        u.role::text = 'SUPER_ADMIN'
        OR (u.role::text IN ('ADMIN', 'ORG_ADMIN', 'ORGANIZATION_ADMIN') AND u.organization_id = v_org_id)
        OR u.id = v_doc_owner
      );

    -- Notify the signer account, when the signer email belongs to a registered user.
    INSERT INTO public.notifications (user_id, title, description, type, read, link)
    SELECT DISTINCT
      u.id,
      'Firma registrada',
      'Tu firma de "' || v_doc_title || '" fue registrada correctamente.',
      'success',
      false,
      '/signatures'
    FROM public.users u
    WHERE
      lower(u.email) = lower(NEW.signer_email)
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = u.id
          AND n.title = 'Firma registrada'
          AND n.description = 'Tu firma de "' || v_doc_title || '" fue registrada correctamente.'
          AND n.created_at > now() - interval '1 minute'
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_signature_request_notify_signed ON public.signature_requests;

CREATE TRIGGER on_signature_request_notify_signed
AFTER UPDATE OF status ON public.signature_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_signature_request_signed();
