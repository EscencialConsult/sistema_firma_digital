-- Storage buckets para Sistema Firma Digital
-- Ejecutar en Supabase → SQL Editor

-- Bucket para documentos KYC (DNI, selfie, CUIL) — privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para PDFs de contratos — público para que el firmante pueda ver el documento
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-pdfs',
  'contract-pdfs',
  true,
  52428800, -- 50 MB
  ARRAY['application/pdf','image/png','image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS: kyc-documents ───────────────────────────────────────────────────────

-- Usuarios solo pueden leer sus propios docs
CREATE POLICY "kyc_user_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuarios solo pueden subir a su propia carpeta
CREATE POLICY "kyc_user_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins pueden ver todos los docs KYC
CREATE POLICY "kyc_admin_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ─── RLS: contract-pdfs ──────────────────────────────────────────────────────

-- Cualquiera puede leer (es público, pero por si acaso se activa RLS)
CREATE POLICY "contract_pdfs_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'contract-pdfs');

-- Solo admins pueden subir
CREATE POLICY "contract_pdfs_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contract-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
