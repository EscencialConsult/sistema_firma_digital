-- Agregar columnas de datos de empresa a organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS address     TEXT,
  ADD COLUMN IF NOT EXISTS city        TEXT,
  ADD COLUMN IF NOT EXISTS province    TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS tax_id      TEXT,
  ADD COLUMN IF NOT EXISTS website     TEXT;
