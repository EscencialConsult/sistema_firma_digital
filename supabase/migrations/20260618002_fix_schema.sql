-- Fix missing columns on documents table
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES public.document_versions(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS template_id TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS template_fields JSONB;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS total_signers INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS completed_signers INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_name TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS sha256_hash TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Fix missing columns on signature_requests
DO $$ BEGIN
  ALTER TABLE public.signature_requests ADD COLUMN IF NOT EXISTS document_version_id UUID REFERENCES public.document_versions(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.signature_requests ADD COLUMN IF NOT EXISTS signer_dni TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.signature_requests ADD COLUMN IF NOT EXISTS signer_cuil TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.signature_requests ADD COLUMN IF NOT EXISTS signer_domicilio TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Fix missing columns on identity_verifications
DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS full_name TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS document_type TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS document_number TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS cuil_cuit TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS birth_date TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS nationality TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS country TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS province TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS city TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS declaration_accepted BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS declaration_text TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS declaration_version TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.identity_verifications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
