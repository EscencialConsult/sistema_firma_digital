-- Agrega soporte para plantillas PDF en contract_templates
-- template_type: 'html' (por defecto) o 'pdf'
-- pdf_storage_path: ruta en el bucket 'contract-pdfs' para plantillas PDF

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
