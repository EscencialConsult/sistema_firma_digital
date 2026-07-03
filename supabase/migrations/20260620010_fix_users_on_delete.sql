-- Migration: Fix Users On Delete Constraints
-- Adds ON DELETE behaviors to foreign keys referencing public.users to allow deleting users.

-- 1. Table: conformity_acceptances (user_id)
ALTER TABLE public.conformity_acceptances
  DROP CONSTRAINT IF EXISTS conformity_acceptances_user_id_fkey,
  ADD CONSTRAINT conformity_acceptances_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

-- 2. Table: signatures (user_id)
ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.signatures
  DROP CONSTRAINT IF EXISTS signatures_user_id_fkey,
  ADD CONSTRAINT signatures_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

-- 3. Table: organization_authorities (user_id)
ALTER TABLE public.organization_authorities
  DROP CONSTRAINT IF EXISTS organization_authorities_user_id_fkey,
  ADD CONSTRAINT organization_authorities_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

-- 4. Table: organization_authorities (authorized_by)
ALTER TABLE public.organization_authorities
  DROP CONSTRAINT IF EXISTS organization_authorities_authorized_by_fkey,
  ADD CONSTRAINT organization_authorities_authorized_by_fkey
    FOREIGN KEY (authorized_by)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

-- 5. Table: documents (owner_id)
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_owner_id_fkey,
  ADD CONSTRAINT documents_owner_id_fkey
    FOREIGN KEY (owner_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;
