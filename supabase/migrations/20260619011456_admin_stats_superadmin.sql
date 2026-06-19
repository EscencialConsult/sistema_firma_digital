-- Fix roles in is_admin and get_admin_stats
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ORGANIZATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Solo admins
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ORGANIZATION_ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN (
    SELECT json_build_object(
      'totalUsers',        (SELECT COUNT(*) FROM public.users WHERE role = 'USER'),
      'verifiedUsers',     (SELECT COUNT(*) FROM public.users WHERE verification_status = 'VERIFIED'),
      'pendingKyc',        (SELECT COUNT(*) FROM public.identity_verifications WHERE status IN ('PENDING', 'IN_REVIEW')),
      'totalContracts',    (SELECT COUNT(*) FROM public.documents),
      'signedContracts',   (SELECT COUNT(*) FROM public.documents WHERE status = 'COMPLETED'),
      'pendingContracts',  (SELECT COUNT(*) FROM public.documents WHERE status IN ('SENT', 'VIEWED', 'CONFORMITY_ACCEPTED')),
      'rejectedContracts', (SELECT COUNT(*) FROM public.documents WHERE status IN ('REJECTED', 'EXPIRED'))
    )
  );
END;
$$;
