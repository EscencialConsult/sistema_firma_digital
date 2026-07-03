-- Storage buckets para Sistema Firma Digital
-- Seguro para ejecutar sobre una DB existente (DROP POLICY IF EXISTS antes de cada CREATE)
-- Ejecutar en Supabase → SQL Editor

-- ─── Buckets ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-pdfs',
  'contract-pdfs',
  true,
  52428800,
  ARRAY['application/pdf','image/png','image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS: kyc-documents ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "kyc_user_select"   ON storage.objects;
DROP POLICY IF EXISTS "kyc_user_insert"   ON storage.objects;
DROP POLICY IF EXISTS "kyc_admin_select"  ON storage.objects;

CREATE POLICY "kyc_user_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND (
    auth.uid()::text = split_part(name, '/', 1)
    OR auth.uid()::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "kyc_user_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (
    auth.uid()::text = split_part(name, '/', 1)
    OR auth.uid()::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "kyc_admin_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN' OR role = 'ORG_ADMIN')
  )
);

-- ─── RLS: contract-pdfs ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "contract_pdfs_public_select" ON storage.objects;
DROP POLICY IF EXISTS "contract_pdfs_admin_insert"  ON storage.objects;

CREATE POLICY "contract_pdfs_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'contract-pdfs');

CREATE POLICY "contract_pdfs_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contract-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
