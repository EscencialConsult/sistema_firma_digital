-- Extender tabla signatures con campos de auditoría
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS fingerprint_data TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS face_verification_method TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS face_similarity_score NUMERIC;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS certificate_serial TEXT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS pdf_url TEXT;
