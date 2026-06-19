-- Agrega URL del PDF firmado al documento
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS final_pdf_url TEXT;

-- Bucket para PDFs consolidados
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-contracts', 'signed-contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Policies: cualquier autenticado puede leer y subir
CREATE POLICY "signed_contracts_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signed-contracts');

CREATE POLICY "signed_contracts_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signed-contracts' AND auth.role() = 'authenticated');

CREATE POLICY "signed_contracts_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'signed-contracts' AND auth.role() = 'authenticated');
