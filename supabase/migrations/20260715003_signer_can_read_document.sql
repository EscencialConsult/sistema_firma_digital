-- Permite a los firmantes leer documentos que les corresponde firmar.
-- Sin esto, el join documents(*) en getMySigningRequests devuelve null
-- para el usuario firmante (RLS lo bloquea) y documentTitle queda vacío.

CREATE POLICY "signer_can_read_document"
ON public.documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.signature_requests sr
    WHERE sr.document_id = documents.id
      AND lower(sr.signer_email) = lower(auth.email())
  )
);

-- Columnas de backup: datos del contrato y la org directamente en signature_requests
-- para que el firmante siempre tenga acceso sin depender de joins.
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS document_title      TEXT,
  ADD COLUMN IF NOT EXISTS organization_name   TEXT,
  ADD COLUMN IF NOT EXISTS organization_logo   TEXT;

-- Backfill de contratos existentes
UPDATE public.signature_requests sr
SET document_title = d.title
FROM public.documents d
WHERE sr.document_id = d.id
  AND sr.document_title IS NULL;

UPDATE public.signature_requests sr
SET
  organization_name = o.name,
  organization_logo = COALESCE(o.logo_light_url, o.logo_dark_url)
FROM public.documents d
JOIN public.organizations o ON o.id = d.organization_id
WHERE sr.document_id = d.id
  AND sr.organization_name IS NULL;
