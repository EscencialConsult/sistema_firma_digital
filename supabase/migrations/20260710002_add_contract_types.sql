-- Tipos de contrato predefinidos + personalizados por org
CREATE TABLE IF NOT EXISTS contract_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tipos del sistema (seed)
INSERT INTO contract_types (name, slug, is_system) VALUES
  ('Pagaré', 'pagare', true),
  ('Contrato de Servicio', 'contrato_servicio', true),
  ('Contrato de Formación', 'contrato_formacion', true),
  ('Convenio', 'convenio', true),
  ('Otro', 'otro', true)
ON CONFLICT DO NOTHING;

-- Agregar contract_type_id a documents y contract_templates
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contract_type_id UUID REFERENCES contract_types(id);
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS contract_type_id UUID REFERENCES contract_types(id);

-- RLS
ALTER TABLE contract_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_contract_types" ON contract_types
  FOR SELECT USING (organization_id IS NULL OR organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()) OR is_system = true);
CREATE POLICY "org_manage_contract_types" ON contract_types
  FOR ALL USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
