-- Notificar a los admins cuando una verificacion KYC queda esperando revision manual.
-- Antes de esto, IN_REVIEW era un estado silencioso: el usuario veia "Verificacion en
-- proceso" indefinidamente y ningun admin se enteraba de que habia alguien en la cola.
-- Corre en la base para que aplique venga de donde venga el cambio de estado
-- (webhook de DIDIT, panel admin o SQL manual).

CREATE OR REPLACE FUNCTION public.notify_kyc_in_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_name   TEXT;
BEGIN
  IF NEW.status = 'IN_REVIEW' AND OLD.status IS DISTINCT FROM 'IN_REVIEW' THEN
    SELECT u.organization_id,
           COALESCE(NULLIF(NEW.full_name, ''), NULLIF(u.full_name, ''), u.email)
    INTO v_org_id, v_name
    FROM public.users u
    WHERE u.id = NEW.user_id;

    v_name := COALESCE(v_name, 'Un usuario');

    -- Admins de la organizacion + super admins.
    INSERT INTO public.notifications (user_id, title, description, type, read, link)
    SELECT DISTINCT
      u.id,
      'KYC pendiente de revision',
      v_name || ' completo la verificacion de identidad y espera aprobacion.',
      'info',
      false,
      '/admin/kyc'
    FROM public.users u
    WHERE
      u.role::text = 'SUPER_ADMIN'
      OR (
        u.role::text IN ('ADMIN', 'ORG_ADMIN', 'ORGANIZATION_ADMIN')
        AND v_org_id IS NOT NULL
        AND u.organization_id = v_org_id
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_kyc_in_review_notify ON public.identity_verifications;

CREATE TRIGGER on_kyc_in_review_notify
AFTER UPDATE OF status ON public.identity_verifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_kyc_in_review();
