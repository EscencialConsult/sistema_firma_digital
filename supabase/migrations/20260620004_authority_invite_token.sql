-- ─── Token de invitación en organization_authorities ─────────────────────────
ALTER TABLE public.organization_authorities
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Rellenar tokens en filas existentes que quedaron NULL
UPDATE public.organization_authorities
SET invite_token = gen_random_uuid()::text
WHERE invite_token IS NULL;

-- ─── Función pública: obtener autoridad por token ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_authority_by_token(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id',              a.id,
    'full_name',       a.full_name,
    'email',           a.email,
    'cuil',            a.cuil,
    'type',            a.type,
    'status',          a.status,
    'notes',           a.notes,
    'invite_token',    a.invite_token,
    'org_name',        o.name,
    'org_logo_dark',   o.logo_dark_url,
    'org_logo_light',  o.logo_light_url
  )
  INTO v_result
  FROM public.organization_authorities a
  JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.invite_token = p_token;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authority_by_token(TEXT) TO anon, authenticated;

-- ─── Función pública: aceptar invitación (PERMANENT) ─────────────────────────
-- Marca la autoridad como ACTIVE y guarda la URL de la firma
CREATE OR REPLACE FUNCTION public.accept_authority_invite(
  p_token        TEXT,
  p_signature_url TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     UUID;
  v_type   TEXT;
  v_status TEXT;
BEGIN
  SELECT id, type, status INTO v_id, v_type, v_status
  FROM public.organization_authorities
  WHERE invite_token = p_token;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF v_status NOT IN ('PENDING') THEN
    RAISE EXCEPTION 'Esta invitación ya fue procesada';
  END IF;

  UPDATE public.organization_authorities
  SET
    status        = 'ACTIVE',
    accepted_at   = now(),
    signature_url = COALESCE(p_signature_url, signature_url)
  WHERE id = v_id;

  RETURN json_build_object('ok', true, 'id', v_id, 'type', v_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_authority_invite(TEXT, TEXT) TO anon, authenticated;
