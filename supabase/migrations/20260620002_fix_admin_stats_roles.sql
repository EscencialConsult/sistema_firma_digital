-- Fix: get_admin_stats usaba 'ADMIN'/'ORGANIZATION_ADMIN' pero los roles son 'ORG_ADMIN'/'SUPER_ADMIN'
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_org_id UUID;
BEGIN
  SELECT role, organization_id INTO v_role, v_org_id
  FROM public.users WHERE id = auth.uid();

  IF v_role NOT IN ('SUPER_ADMIN', 'ORG_ADMIN') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- SUPER_ADMIN: stats globales. ORG_ADMIN: solo su organización.
  IF v_role = 'SUPER_ADMIN' THEN
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
  ELSE
    RETURN (
      SELECT json_build_object(
        'totalUsers',        (SELECT COUNT(*) FROM public.users WHERE organization_id = v_org_id AND role = 'USER'),
        'verifiedUsers',     (SELECT COUNT(*) FROM public.users WHERE organization_id = v_org_id AND verification_status = 'VERIFIED'),
        'pendingKyc',        (SELECT COUNT(*) FROM public.identity_verifications WHERE organization_id = v_org_id AND status IN ('PENDING', 'IN_REVIEW')),
        'totalContracts',    (SELECT COUNT(*) FROM public.documents WHERE organization_id = v_org_id),
        'signedContracts',   (SELECT COUNT(*) FROM public.documents WHERE organization_id = v_org_id AND status = 'COMPLETED'),
        'pendingContracts',  (SELECT COUNT(*) FROM public.documents WHERE organization_id = v_org_id AND status IN ('SENT', 'VIEWED', 'CONFORMITY_ACCEPTED')),
        'rejectedContracts', (SELECT COUNT(*) FROM public.documents WHERE organization_id = v_org_id AND status IN ('REJECTED', 'EXPIRED'))
      )
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
