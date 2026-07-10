-- ============================================================
-- Fase 1: Posición de firma configurable en documentos
-- ============================================================

-- Posición de firma en documentos (page, x, y, width, height en mm)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signature_position JSONB DEFAULT '{"page":"last","x":50,"y":50,"width":80,"height":30}';

-- Posición de firma en templates (se hereda al crear contratos)
ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS signature_position JSONB;
