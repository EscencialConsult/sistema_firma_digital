-- ============================================================================
-- Update fn_handle_new_user to assign organization_id and perform backfill
-- ============================================================================

-- 1. Redefine fn_handle_new_user to copy organization_id from auth.users metadata
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Extract organization_id from metadata if present and not empty
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != '' THEN
    BEGIN
      v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;
  END IF;

  -- Fallback: if no organization_id is found in metadata, assign the first organization in the database (e.g. Escencial S.A.S.)
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id 
    FROM public.organizations 
    ORDER BY created_at ASC 
    LIMIT 1;
  END IF;

  INSERT INTO public.users (id, email, full_name, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    v_org_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    organization_id = COALESCE(public.users.organization_id, EXCLUDED.organization_id),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Backfill existing users who have organization_id in auth.users metadata but null in public.users
UPDATE public.users pu
SET organization_id = (au.raw_user_meta_data->>'organization_id')::uuid
FROM auth.users au
WHERE pu.id = au.id
  AND pu.organization_id IS NULL
  AND au.raw_user_meta_data->>'organization_id' IS NOT NULL
  AND au.raw_user_meta_data->>'organization_id' != '';

-- 3. Fallback backfill: assign any user with role != 'SUPER_ADMIN' that still has null organization_id to the first organization
UPDATE public.users
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1)
WHERE organization_id IS NULL
  AND role != 'SUPER_ADMIN';
