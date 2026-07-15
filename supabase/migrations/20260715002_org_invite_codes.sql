-- ============================================================================
-- Códigos de invitación por organización
--
-- Cada org tiene un código único y reutilizable (ej: "A3F9B2C1").
-- El usuario lo ingresa en su panel y queda habilitado para esa org
-- sin que el admin tenga que invitar a nadie manualmente.
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Generar códigos para las orgs que ya existen
UPDATE public.organizations
SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

-- Asegurar que las nuevas orgs siempre tengan código al crearse
CREATE OR REPLACE FUNCTION public.fn_set_org_invite_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_invite_code ON public.organizations;
CREATE TRIGGER trg_org_invite_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_org_invite_code();

-- ─── Función pública: buscar org por código ──────────────────────────────────
-- Cualquier usuario autenticado puede buscar una org por su código.
-- No expone datos sensibles — solo nombre, slug y branding.

CREATE OR REPLACE FUNCTION public.get_org_by_invite_code(p_code TEXT)
RETURNS TABLE (
  id             UUID,
  name           TEXT,
  slug           TEXT,
  logo_dark_url  TEXT,
  logo_light_url TEXT,
  brand_primary  TEXT,
  is_active      BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, name, slug, logo_dark_url, logo_light_url, brand_primary, is_active
  FROM public.organizations
  WHERE upper(invite_code) = upper(p_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_by_invite_code(TEXT) TO authenticated;

-- ─── Función: regenerar el código (solo admin de esa org) ────────────────────

CREATE OR REPLACE FUNCTION public.regenerate_org_invite_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_code TEXT;
  v_user_org UUID;
  v_role     TEXT;
BEGIN
  SELECT organization_id, role::text INTO v_user_org, v_role
  FROM public.users WHERE id = auth.uid();

  IF v_role NOT IN ('ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_role != 'SUPER_ADMIN' AND v_user_org != p_org_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  UPDATE public.organizations SET invite_code = v_new_code WHERE id = p_org_id;
  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_org_invite_code(UUID) TO authenticated;
