-- Versión de la plantilla: empieza en 0 (se muestra como v1.0)
-- Cada actualización incrementa este contador → v1.1, v1.2, ...
ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS version_minor INTEGER DEFAULT 0;
