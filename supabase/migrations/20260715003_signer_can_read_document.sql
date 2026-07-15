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

-- Columna de backup: guarda el título del documento directamente en signature_requests
-- para que el firmante siempre tenga acceso sin depender del join a documents.
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS document_title TEXT;

-- Backfill de contratos existentes
UPDATE public.signature_requests sr
SET document_title = d.title
FROM public.documents d
WHERE sr.document_id = d.id
  AND sr.document_title IS NULL;
