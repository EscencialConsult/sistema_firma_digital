-- ============================================================================
-- 1. Create table `organizations`
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_dark_url TEXT,
    logo_light_url TEXT,
    primary_color TEXT,
    plan TEXT DEFAULT 'FREE',
    is_active BOOLEAN DEFAULT true,
    didit_workflow_id TEXT,
    max_users INTEGER DEFAULT 10,
    contact_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON public.organizations;
CREATE TRIGGER trigger_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE PROCEDURE update_organizations_updated_at();

-- ============================================================================
-- 2. Update `users` table
-- ============================================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ORG_ADMIN';
COMMIT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Drop existing constraint if any, to avoid conflicts
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'USER', 'ADMIN'));

-- ============================================================================
-- 3. Row Level Security on `organizations`
-- ============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SUPER_ADMIN can see all organizations" ON public.organizations;
CREATE POLICY "SUPER_ADMIN can see all organizations"
ON public.organizations
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "ORG_ADMIN can see their own organization" ON public.organizations;
CREATE POLICY "ORG_ADMIN can see their own organization"
ON public.organizations
FOR SELECT
USING (
  id = (SELECT organization_id FROM public.users WHERE id = auth.uid() AND role = 'ORG_ADMIN')
);

-- General users might need to read their org info
DROP POLICY IF EXISTS "Users can read their own organization" ON public.organizations;
CREATE POLICY "Users can read their own organization"
ON public.organizations
FOR SELECT
USING (
  id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================================
-- 4. Storage Bucket for `org-logos`
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('org-logos', 'org-logos', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket RLS
DROP POLICY IF EXISTS "Logos are publicly accessible." ON storage.objects;
CREATE POLICY "Logos are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'org-logos' );

DROP POLICY IF EXISTS "Admins can upload logos." ON storage.objects;
CREATE POLICY "Admins can upload logos."
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos' 
  AND auth.role() = 'authenticated'
  AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ORG_ADMIN')
);
