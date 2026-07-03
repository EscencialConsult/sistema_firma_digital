-- Ensure existing signatures tables have the user_id column expected by RLS and the portal insert flow.
ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.signatures
  DROP CONSTRAINT IF EXISTS signatures_user_id_fkey,
  ADD CONSTRAINT signatures_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;
