-- ============================================================
-- Fase 8.1: Tabla de plantillas de pago (modelo de cuotas)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC NOT NULL,
  installment_count INTEGER NOT NULL,
  installment_amount NUMERIC,
  frequency TEXT DEFAULT 'monthly',
  has_mora BOOLEAN DEFAULT true,
  mora_rate NUMERIC DEFAULT 3,
  extra_variables JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_manage_payment_templates"
  ON payment_templates
  FOR ALL
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Vínculo de plantilla de pago a un contrato específico
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS payment_template_id UUID
    REFERENCES payment_templates(id) ON DELETE SET NULL;

-- Seed data para demo
INSERT INTO payment_templates (organization_id, name, description, total_amount, installment_count, installment_amount, frequency, has_mora, mora_rate)
SELECT
  o.id,
  'Plan de capacitación — 6 cuotas mensuales',
  'Capacitación en firma electrónica: curso completo + certificación.',
  180000,
  6,
  30000,
  'monthly',
  true,
  3
FROM organizations o
LIMIT 1
ON CONFLICT DO NOTHING;
