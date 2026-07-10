DROP POLICY IF EXISTS contract_pdfs_admin_insert ON storage.objects;
CREATE POLICY contract_pdfs_admin_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'contract-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN')
  )
);
