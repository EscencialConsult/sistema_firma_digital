-- Agrega DNI y domicilio a organization_authorities
-- para poder auto-completar esos campos al seleccionar una autoridad en la creación de contratos.

ALTER TABLE public.organization_authorities
  ADD COLUMN IF NOT EXISTS dni       TEXT,
  ADD COLUMN IF NOT EXISTS domicilio TEXT;
