-- ============================================================
-- SISTEMA FIRMA DIGITAL — ESCENCIAL CONSULTORA S.A.S.
-- Schema completo para Supabase (PostgreSQL)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- ORDEN DE EJECUCIÓN:
--   1. Este archivo completo (schema + seed)
--   2. supabase/storage_policies.sql
--   3. Actualizar web-portal/.env con tus credenciales
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ────────────────────────────────────────────────────────────
-- TIPOS ENUM
-- ────────────────────────────────────────────────────────────

-- Usar DO $$ para no fallar si ya existen (útil en re-ejecuciones)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('USER', 'ADMIN', 'ORGANIZATION_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.certificate_status AS ENUM ('NONE', 'ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_document_type AS ENUM ('DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_status AS ENUM (
    'DRAFT', 'SENT', 'VIEWED', 'CONFORMITY_ACCEPTED',
    'SIGNED', 'REJECTED', 'COMPLETED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.signer_status AS ENUM (
    'PENDING', 'VIEWED', 'CONFORMITY_ACCEPTED', 'SIGNED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────
-- TABLAS
-- ────────────────────────────────────────────────────────────

-- 1. Organizaciones (referenciada por users)
CREATE TABLE IF NOT EXISTS public.organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  cuit         TEXT UNIQUE,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.organizations IS 'Empresas/organizaciones clientes de Escencial.';

-- 2. Perfiles de usuario (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL UNIQUE,
  full_name           TEXT NOT NULL,
  role                public.user_role NOT NULL DEFAULT 'USER',
  verification_status public.verification_status NOT NULL DEFAULT 'PENDING',
  certificate_status  public.certificate_status NOT NULL DEFAULT 'NONE',
  phone               TEXT,
  address             TEXT,
  document_number     TEXT,
  cuil_cuit           TEXT,
  birth_date          DATE,
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.users IS 'Perfil extendido del usuario. Se crea automáticamente al registrarse en Supabase Auth.';

-- 3. Verificaciones KYC
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status            public.verification_status NOT NULL DEFAULT 'PENDING',
  -- Datos personales (desnormalizados para auditoría — snapshot al momento del envío)
  full_name         TEXT,
  document_type     TEXT DEFAULT 'DNI',
  document_number   TEXT,
  cuil_cuit         TEXT,
  birth_date        DATE,
  phone             TEXT,
  address           TEXT,
  city              TEXT,
  province          TEXT,
  country           TEXT DEFAULT 'Argentina',
  -- Metadatos de revisión
  submitted_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason  TEXT,
  expires_at        TIMESTAMPTZ, -- se actualiza en trigger al aprobar
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.identity_verifications IS 'Una verificación KYC por proceso. Un usuario puede tener múltiples (re-intentos).';

-- 4. Documentos subidos para KYC (frente DNI, dorso DNI, selfie)
CREATE TABLE IF NOT EXISTS public.identity_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id  UUID NOT NULL REFERENCES public.identity_verifications(id) ON DELETE CASCADE,
  type             public.kyc_document_type NOT NULL,
  file_name        TEXT NOT NULL,
  storage_path     TEXT NOT NULL,   -- path dentro del bucket 'identity-documents'
  mime_type        TEXT NOT NULL,
  file_size        BIGINT NOT NULL,
  sha256_hash      TEXT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verification_id, type)    -- un archivo por tipo por verificación
);
COMMENT ON TABLE public.identity_documents IS 'Archivos subidos durante el proceso KYC. Referencia a Storage bucket identity-documents.';

-- 5. Contratos / Documentos
CREATE TABLE IF NOT EXISTS public.documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  template_id        TEXT,           -- 'formacion' | 'inmueble' | 'reserva' | 'software' | 'soporte'
  template_fields    JSONB DEFAULT '{}', -- campos llenados del template (montos, fechas, etc.)
  status             public.document_status NOT NULL DEFAULT 'DRAFT',
  owner_id           UUID NOT NULL REFERENCES public.users(id),
  total_signers      INTEGER NOT NULL DEFAULT 1,
  completed_signers  INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.documents IS 'Contratos creados. Cada documento puede tener múltiples versiones y firmantes.';

-- 6. Versiones del documento (cada PDF genera una versión con hash)
CREATE TABLE IF NOT EXISTS public.document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL DEFAULT 1,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,    -- path dentro del bucket 'contract-pdfs'
  sha256_hash     TEXT NOT NULL,
  file_size       BIGINT,
  uploaded_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);
COMMENT ON TABLE public.document_versions IS 'Cada versión del PDF. El hash SHA-256 garantiza integridad.';

-- 7. Solicitudes de firma (una por firmante por documento)
CREATE TABLE IF NOT EXISTS public.signature_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES public.document_versions(id),
  signer_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  signer_email        TEXT NOT NULL,
  signer_name         TEXT NOT NULL,
  signer_dni          TEXT,
  signer_cuil         TEXT,
  signer_domicilio    TEXT,
  status              public.signer_status NOT NULL DEFAULT 'PENDING',
  accepted_conformity BOOLEAN NOT NULL DEFAULT false,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at           TIMESTAMPTZ,
  signed_at           TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.signature_requests IS 'Invitación de firma enviada a cada firmante.';

-- 8. Aceptaciones de conformidad (registro inmutable)
CREATE TABLE IF NOT EXISTS public.conformity_acceptances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  accepted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  acceptance_text       TEXT NOT NULL,
  ip_address            TEXT,
  user_agent            TEXT
);
COMMENT ON TABLE public.conformity_acceptances IS 'Registro de aceptación de conformidad. Inmutable por RLS.';

-- 9. Desafíos OTP (nunca almacenamos el código en texto plano)
CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  code_hash             TEXT NOT NULL, -- bcrypt del código de 6 dígitos
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used                  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.otp_challenges IS 'Códigos OTP hasheados. Accesible solo vía Edge Functions (RLS cierra acceso directo).';

-- 10. Firmas completadas (registro de la firma digital)
CREATE TABLE IF NOT EXISTS public.signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  document_id           UUID NOT NULL REFERENCES public.documents(id),
  document_version_id   UUID REFERENCES public.document_versions(id),
  signer_email          TEXT NOT NULL,
  signer_name           TEXT NOT NULL,
  document_hash         TEXT NOT NULL,     -- SHA-256 del PDF en el momento de la firma
  ip_address            TEXT,
  user_agent            TEXT,
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata              JSONB DEFAULT '{}'
);
COMMENT ON TABLE public.signatures IS 'Registro inmutable de cada firma digital completada.';

-- 11. Log de auditoría general
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,          -- 'USER_REGISTERED', 'DOCUMENT_SENT', 'DOCUMENT_SIGNED', etc.
  entity_type    TEXT,                   -- 'user', 'document', 'signature_request', etc.
  entity_id      UUID,
  document_hash  TEXT,
  ip_address     TEXT,
  user_agent     TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.audit_logs IS 'Log completo de todas las acciones. Solo INSERT, nunca UPDATE ni DELETE.';


-- ────────────────────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email              ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role               ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification       ON public.users(verification_status);
CREATE INDEX IF NOT EXISTS idx_users_organization       ON public.users(organization_id);

CREATE INDEX IF NOT EXISTS idx_kyc_user                 ON public.identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status               ON public.identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_verification    ON public.identity_documents(verification_id);

CREATE INDEX IF NOT EXISTS idx_docs_owner               ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_docs_status              ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_docs_template            ON public.documents(template_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document    ON public.document_versions(document_id);

CREATE INDEX IF NOT EXISTS idx_sig_req_document         ON public.signature_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_signer_email     ON public.signature_requests(signer_email);
CREATE INDEX IF NOT EXISTS idx_sig_req_signer_id        ON public.signature_requests(signer_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_status           ON public.signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_sig_req_expires          ON public.signature_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_signatures_document      ON public.signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signer_email  ON public.signatures(signer_email);

CREATE INDEX IF NOT EXISTS idx_audit_user               ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity             ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created            ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action             ON public.audit_logs(action);


-- ────────────────────────────────────────────────────────────
-- FUNCIONES Y TRIGGERS
-- ────────────────────────────────────────────────────────────

-- Trigger: actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_kyc_updated_at
    BEFORE UPDATE ON public.identity_verifications
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sig_req_updated_at
    BEFORE UPDATE ON public.signature_requests
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger: al crear usuario en Supabase Auth → crear perfil en public.users
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- Trigger: al aprobar KYC → actualizar verification_status en users + set expires_at
CREATE OR REPLACE FUNCTION public.fn_on_kyc_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se aprueba una verificación
  IF NEW.status = 'VERIFIED' AND OLD.status != 'VERIFIED' THEN
    UPDATE public.users
    SET verification_status = 'VERIFIED',
        certificate_status  = 'ACTIVE',
        document_number     = COALESCE(NEW.document_number, document_number),
        cuil_cuit           = COALESCE(NEW.cuil_cuit, cuil_cuit),
        birth_date          = COALESCE(NEW.birth_date, birth_date),
        updated_at          = now()
    WHERE id = NEW.user_id;

    UPDATE public.identity_verifications
    SET expires_at = now() + INTERVAL '1 year'
    WHERE id = NEW.id;
  END IF;

  -- Cuando se rechaza
  IF NEW.status = 'REJECTED' AND OLD.status != 'REJECTED' THEN
    UPDATE public.users
    SET verification_status = 'REJECTED',
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_kyc_status_change ON public.identity_verifications;
CREATE TRIGGER trg_kyc_status_change
  AFTER UPDATE OF status ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_on_kyc_status_change();

-- Trigger: al firmar → actualizar completed_signers y status del documento
CREATE OR REPLACE FUNCTION public.fn_on_signature_request_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_completed INTEGER;
  v_total     INTEGER;
BEGIN
  IF NEW.status = 'SIGNED' AND OLD.status != 'SIGNED' THEN
    SELECT COUNT(*), d.total_signers
    INTO v_completed, v_total
    FROM public.signature_requests sr
    JOIN public.documents d ON d.id = sr.document_id
    WHERE sr.document_id = NEW.document_id AND sr.status = 'SIGNED'
    GROUP BY d.total_signers;

    UPDATE public.documents
    SET
      completed_signers = v_completed,
      status = CASE
        WHEN v_completed >= v_total THEN 'COMPLETED'::public.document_status
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.document_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_signature_request_signed ON public.signature_requests;
CREATE TRIGGER trg_signature_request_signed
  AFTER UPDATE OF status ON public.signature_requests
  FOR EACH ROW
  WHEN (NEW.status = 'SIGNED')
  EXECUTE FUNCTION public.fn_on_signature_request_signed();


-- ────────────────────────────────────────────────────────────
-- FUNCIÓN RPC: get_admin_stats()
-- Uso: supabase.rpc('get_admin_stats')
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Solo admins
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ORGANIZATION_ADMIN')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN (
    SELECT json_build_object(
      'totalUsers',        (SELECT COUNT(*) FROM public.users WHERE role = 'USER'),
      'verifiedUsers',     (SELECT COUNT(*) FROM public.users WHERE verification_status = 'VERIFIED'),
      'pendingKyc',        (SELECT COUNT(*) FROM public.identity_verifications WHERE status IN ('PENDING', 'IN_REVIEW')),
      'totalContracts',    (SELECT COUNT(*) FROM public.documents),
      'signedContracts',   (SELECT COUNT(*) FROM public.documents WHERE status = 'COMPLETED'),
      'pendingContracts',  (SELECT COUNT(*) FROM public.documents WHERE status IN ('SENT', 'VIEWED', 'CONFORMITY_ACCEPTED')),
      'rejectedContracts', (SELECT COUNT(*) FROM public.documents WHERE status IN ('REJECTED', 'EXPIRED'))
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conformity_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;

-- Helper: ¿es admin el usuario actual?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('ADMIN', 'ORGANIZATION_ADMIN')
  );
$$;

-- ── users ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users: read own"   ON public.users;
DROP POLICY IF EXISTS "users: read admin" ON public.users;
DROP POLICY IF EXISTS "users: update own" ON public.users;
DROP POLICY IF EXISTS "users: update admin" ON public.users;

CREATE POLICY "users: read own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users: read admin"
  ON public.users FOR SELECT
  USING (public.is_admin());

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users: update admin"
  ON public.users FOR UPDATE
  USING (public.is_admin());

-- ── organizations ────────────────────────────────────────────────

DROP POLICY IF EXISTS "orgs: read authenticated" ON public.organizations;
DROP POLICY IF EXISTS "orgs: write admin"        ON public.organizations;

CREATE POLICY "orgs: read authenticated"
  ON public.organizations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "orgs: write admin"
  ON public.organizations FOR ALL
  USING (public.is_admin());

-- ── identity_verifications ────────────────────────────────────────

DROP POLICY IF EXISTS "kyc: read own"      ON public.identity_verifications;
DROP POLICY IF EXISTS "kyc: insert own"    ON public.identity_verifications;
DROP POLICY IF EXISTS "kyc: update own"    ON public.identity_verifications;
DROP POLICY IF EXISTS "kyc: read admin"    ON public.identity_verifications;
DROP POLICY IF EXISTS "kyc: update admin"  ON public.identity_verifications;

CREATE POLICY "kyc: read own"
  ON public.identity_verifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "kyc: insert own"
  ON public.identity_verifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kyc: update own pending"
  ON public.identity_verifications FOR UPDATE
  USING (user_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "kyc: read admin"
  ON public.identity_verifications FOR SELECT
  USING (public.is_admin());

CREATE POLICY "kyc: update admin"
  ON public.identity_verifications FOR UPDATE
  USING (public.is_admin());

-- ── identity_documents ───────────────────────────────────────────

DROP POLICY IF EXISTS "kyc_docs: read own"    ON public.identity_documents;
DROP POLICY IF EXISTS "kyc_docs: insert own"  ON public.identity_documents;
DROP POLICY IF EXISTS "kyc_docs: read admin"  ON public.identity_documents;

CREATE POLICY "kyc_docs: read own"
  ON public.identity_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.identity_verifications v
      WHERE v.id = verification_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "kyc_docs: insert own"
  ON public.identity_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.identity_verifications v
      WHERE v.id = verification_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "kyc_docs: read admin"
  ON public.identity_documents FOR SELECT
  USING (public.is_admin());

-- ── documents (contratos) ─────────────────────────────────────────

DROP POLICY IF EXISTS "docs: read own or signer" ON public.documents;
DROP POLICY IF EXISTS "docs: read admin"         ON public.documents;
DROP POLICY IF EXISTS "docs: insert admin"       ON public.documents;
DROP POLICY IF EXISTS "docs: update admin"       ON public.documents;

CREATE POLICY "docs: read own or signer"
  ON public.documents FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.signature_requests sr
      WHERE sr.document_id = id
        AND (sr.signer_id = auth.uid()
          OR sr.signer_email = (SELECT email FROM public.users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "docs: read admin"
  ON public.documents FOR SELECT
  USING (public.is_admin());

CREATE POLICY "docs: insert admin"
  ON public.documents FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "docs: update admin"
  ON public.documents FOR UPDATE
  USING (public.is_admin());

-- ── document_versions ─────────────────────────────────────────────

DROP POLICY IF EXISTS "doc_versions: read if can see doc" ON public.document_versions;
DROP POLICY IF EXISTS "doc_versions: insert admin"        ON public.document_versions;

CREATE POLICY "doc_versions: read if can see doc"
  ON public.document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND (
        d.owner_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.signature_requests sr
          WHERE sr.document_id = d.id
            AND (sr.signer_id = auth.uid()
              OR sr.signer_email = (SELECT email FROM public.users WHERE id = auth.uid()))
        )
      )
    )
  );

CREATE POLICY "doc_versions: insert admin"
  ON public.document_versions FOR INSERT
  WITH CHECK (public.is_admin());

-- ── signature_requests ────────────────────────────────────────────

DROP POLICY IF EXISTS "sig_req: read own"    ON public.signature_requests;
DROP POLICY IF EXISTS "sig_req: read admin"  ON public.signature_requests;
DROP POLICY IF EXISTS "sig_req: insert admin"ON public.signature_requests;
DROP POLICY IF EXISTS "sig_req: update signer" ON public.signature_requests;
DROP POLICY IF EXISTS "sig_req: update admin"  ON public.signature_requests;

CREATE POLICY "sig_req: read own"
  ON public.signature_requests FOR SELECT
  USING (
    signer_id = auth.uid()
    OR signer_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "sig_req: read admin"
  ON public.signature_requests FOR SELECT
  USING (public.is_admin());

CREATE POLICY "sig_req: insert admin"
  ON public.signature_requests FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "sig_req: update signer"
  ON public.signature_requests FOR UPDATE
  USING (
    signer_id = auth.uid()
    OR signer_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "sig_req: update admin"
  ON public.signature_requests FOR UPDATE
  USING (public.is_admin());

-- ── conformity_acceptances ────────────────────────────────────────

DROP POLICY IF EXISTS "conformity: insert signer" ON public.conformity_acceptances;
DROP POLICY IF EXISTS "conformity: read admin"    ON public.conformity_acceptances;

CREATE POLICY "conformity: insert signer"
  ON public.conformity_acceptances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.signature_requests sr
      WHERE sr.id = signature_request_id
        AND (sr.signer_id = auth.uid()
          OR sr.signer_email = (SELECT email FROM public.users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "conformity: read admin"
  ON public.conformity_acceptances FOR SELECT
  USING (public.is_admin());

-- ── otp_challenges: bloqueado — solo accesible via Edge Functions ─

DROP POLICY IF EXISTS "otp: no direct access" ON public.otp_challenges;
CREATE POLICY "otp: no direct access"
  ON public.otp_challenges
  USING (false);

-- ── signatures ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "signatures: read own"   ON public.signatures;
DROP POLICY IF EXISTS "signatures: read admin" ON public.signatures;

CREATE POLICY "signatures: read own"
  ON public.signatures FOR SELECT
  USING (signer_email = (SELECT email FROM public.users WHERE id = auth.uid()));

CREATE POLICY "signatures: read admin"
  ON public.signatures FOR SELECT
  USING (public.is_admin());

-- ── audit_logs ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "audit: read own"   ON public.audit_logs;
DROP POLICY IF EXISTS "audit: read admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit: insert"     ON public.audit_logs;

CREATE POLICY "audit: read own"
  ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "audit: read admin"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "audit: insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKETS (ejecutar por separado o desde Dashboard)
-- ────────────────────────────────────────────────────────────
-- Crear manualmente en Supabase Dashboard → Storage → New bucket:
--
--   Bucket 1:  identity-documents    (private, max 10MB, jpg/png/pdf)
--   Bucket 2:  contract-pdfs         (private, max 25MB, pdf)
--
-- Política Storage para identity-documents:
--   SELECT: usuario puede leer sus propios archivos
--     (bucket_id = 'identity-documents' AND auth.uid()::text = split_part(name, '/', 1))
--   INSERT: usuario puede subir a su carpeta
--     (bucket_id = 'identity-documents' AND auth.uid()::text = split_part(name, '/', 1))
--   SELECT admin: is_admin() = true
--
-- Política Storage para contract-pdfs:
--   SELECT: admin O firmante del contrato (verificar contra signature_requests)
--   INSERT: solo admin


-- ────────────────────────────────────────────────────────────
-- DATOS DE PRUEBA (SEED)
-- Ejecutar SOLO en desarrollo/staging. NO en producción.
-- Passwords: Admin123456 / Alumno123 / Nuevo123 / Review123 / Rejected123
-- ────────────────────────────────────────────────────────────

-- UUIDs fijos para poder referenciar entre tablas
DO $$
DECLARE
  uid_admin   UUID := '10000000-0000-0000-0000-000000000001';
  uid_alumno  UUID := '10000000-0000-0000-0000-000000000002';
  uid_pending UUID := '10000000-0000-0000-0000-000000000003';
  uid_review  UUID := '10000000-0000-0000-0000-000000000004';
  uid_reject  UUID := '10000000-0000-0000-0000-000000000005';
  kyc_review  UUID := '20000000-0000-0000-0000-000000000001';
  kyc_reject  UUID := '20000000-0000-0000-0000-000000000002';
  doc_001     UUID := '30000000-0000-0000-0000-000000000001';
  doc_002     UUID := '30000000-0000-0000-0000-000000000002';
  doc_003     UUID := '30000000-0000-0000-0000-000000000003';
BEGIN

-- ── AUTH USERS (seed directo en auth.users) ─────────────────────
-- Nota: En Supabase Cloud esto funciona desde el SQL Editor.
-- El campo instance_id es el default del proyecto.

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, aud, role, created_at, updated_at, confirmation_token
)
SELECT * FROM (VALUES
  (uid_admin,  '00000000-0000-0000-0000-000000000000'::uuid, 'admin@escencial.com',   crypt('Admin123456', gen_salt('bf')), now()::timestamptz, '{"full_name":"Santiago Admin"}'::jsonb,    'authenticated', 'authenticated', now()::timestamptz, now()::timestamptz, ''),
  (uid_alumno, '00000000-0000-0000-0000-000000000000'::uuid, 'alumno@gmail.com',      crypt('Alumno123',   gen_salt('bf')), now()::timestamptz, '{"full_name":"María González"}'::jsonb,   'authenticated', 'authenticated', now()::timestamptz, now()::timestamptz, ''),
  (uid_pending,'00000000-0000-0000-0000-000000000000'::uuid, 'nuevo@gmail.com',       crypt('Nuevo123',    gen_salt('bf')), now()::timestamptz, '{"full_name":"Juan Pérez"}'::jsonb,       'authenticated', 'authenticated', now()::timestamptz, now()::timestamptz, ''),
  (uid_review, '00000000-0000-0000-0000-000000000000'::uuid, 'revision@gmail.com',    crypt('Review123',   gen_salt('bf')), now()::timestamptz, '{"full_name":"Lucas Rodríguez"}'::jsonb,  'authenticated', 'authenticated', now()::timestamptz, now()::timestamptz, ''),
  (uid_reject, '00000000-0000-0000-0000-000000000000'::uuid, 'rechazado@gmail.com',   crypt('Rejected123', gen_salt('bf')), now()::timestamptz, '{"full_name":"Ana Martínez"}'::jsonb,    'authenticated', 'authenticated', now()::timestamptz, now()::timestamptz, '')
) AS v(id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, created_at, updated_at, confirmation_token)
ON CONFLICT (id) DO NOTHING;

-- El trigger fn_handle_new_user ya crea los perfiles en public.users.
-- Sólo actualizamos los roles y estados específicos:

UPDATE public.users SET
  role = 'ADMIN',
  verification_status = 'VERIFIED',
  certificate_status  = 'ACTIVE'
WHERE id = uid_admin;

UPDATE public.users SET
  verification_status = 'VERIFIED',
  certificate_status  = 'ACTIVE',
  document_number     = '33456789',
  cuil_cuit           = '27-33456789-3'
WHERE id = uid_alumno;

UPDATE public.users SET
  verification_status = 'IN_REVIEW',
  document_number     = '40123456',
  cuil_cuit           = '20-40123456-7'
WHERE id = uid_review;

UPDATE public.users SET
  verification_status = 'REJECTED'
WHERE id = uid_reject;

-- ── KYC VERIFICATIONS ──────────────────────────────────────────────

INSERT INTO public.identity_verifications (
  id, user_id, status, full_name, document_type, document_number,
  cuil_cuit, birth_date, phone, address, city, province, country,
  submitted_at, created_at
) VALUES
  (
    kyc_review, uid_review, 'IN_REVIEW',
    'Lucas Rodríguez', 'DNI', '40123456', '20-40123456-7',
    '1998-03-15', '+54 381 555 1234', 'Av. Mate de Luna 2500',
    'San Miguel de Tucumán', 'Tucumán', 'Argentina',
    '2026-06-15T10:05:00Z', '2026-06-15T09:50:00Z'
  ),
  (
    kyc_reject, uid_reject, 'REJECTED',
    'Ana Martínez', 'DNI', '38765432', '27-38765432-1',
    '1995-11-20', '+54 381 555 5678', 'Calle Lamadrid 800',
    'San Miguel de Tucumán', 'Tucumán', 'Argentina',
    '2026-06-14T14:05:00Z', '2026-06-14T13:45:00Z'
  )
ON CONFLICT (id) DO NOTHING;

UPDATE public.identity_verifications SET
  reviewed_at      = '2026-06-14T16:30:00Z',
  reviewed_by      = uid_admin,
  rejection_reason = 'La selfie no coincide con la foto del DNI. Por favor, tomá una nueva foto.'
WHERE id = kyc_reject;

-- ── DOCUMENTOS (contratos de prueba) ─────────────────────────────

INSERT INTO public.documents (
  id, title, description, template_id, template_fields, status,
  owner_id, total_signers, completed_signers, created_at, updated_at
) VALUES
  (
    doc_001,
    'Contrato de Prestación de Servicios de Formación y Convenio de Pago Diferido',
    'Alumno: María González (alumno@gmail.com) — Curso Desarrollo Web Full Stack',
    'formacion',
    '{"curso_nombre":"Desarrollo Web Full Stack","monto_total":"150000","monto_cuota":"25000","cantidad_cuotas":"6","fecha_inicio":"2026-07-01","fecha_vencimiento":"2026-12-01","jurisdiccion":"Ciudad Autónoma de Buenos Aires"}'::jsonb,
    'SENT',
    uid_admin, 1, 0,
    '2026-06-10T09:00:00Z', '2026-06-10T09:30:00Z'
  ),
  (
    doc_002,
    'Contrato de Prestación de Servicios de Formación y Convenio de Pago Diferido',
    'Alumno: María González (alumno@gmail.com) — Curso UX/UI Design',
    'formacion',
    '{"curso_nombre":"UX/UI Design","monto_total":"120000","monto_cuota":"40000","cantidad_cuotas":"3","fecha_inicio":"2026-08-01","fecha_vencimiento":"2026-10-01","jurisdiccion":"Ciudad Autónoma de Buenos Aires"}'::jsonb,
    'COMPLETED',
    uid_admin, 1, 1,
    '2026-05-20T11:00:00Z', '2026-05-22T15:45:00Z'
  ),
  (
    doc_003,
    'Contrato de Locación de Obra para Desarrollo de Software y Plataforma Digital',
    'Comitente: María González — Sistema de Firma Digital Escencial',
    'software',
    '{"plataforma_descripcion":"Sistema de firma digital","precio_total":"800000","condiciones_pago":"50% inicio · 50% entrega","fecha_inicio":"2026-04-01","fecha_entrega":"2026-09-01"}'::jsonb,
    'EXPIRED',
    uid_admin, 1, 0,
    '2026-04-01T08:00:00Z', '2026-04-01T08:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

-- ── DOCUMENT VERSIONS ──────────────────────────────────────────────

INSERT INTO public.document_versions (
  document_id, version_number, file_name, storage_path,
  sha256_hash, file_size, uploaded_by
) VALUES
  (
    doc_001, 1,
    'contrato_formacion_maria_gonzalez.pdf',
    'contracts/10000000-0000-0000-0000-000000000002/contrato_formacion_maria_gonzalez_v1.pdf',
    'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    245000, uid_admin
  ),
  (
    doc_002, 1,
    'contrato_uxui_maria_gonzalez.pdf',
    'contracts/10000000-0000-0000-0000-000000000002/contrato_uxui_maria_gonzalez_v1.pdf',
    'f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba9876',
    198000, uid_admin
  ),
  (
    doc_002, 2,
    'contrato_uxui_maria_gonzalez_firmado.pdf',
    'contracts/10000000-0000-0000-0000-000000000002/contrato_uxui_maria_gonzalez_v2_firmado.pdf',
    'f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba98xx',
    210000, uid_admin
  )
ON CONFLICT (document_id, version_number) DO NOTHING;

-- ── SIGNATURE REQUESTS ─────────────────────────────────────────────

INSERT INTO public.signature_requests (
  id, document_id, signer_id, signer_email, signer_name,
  signer_dni, signer_cuil, status, sent_at, expires_at
) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    doc_001, uid_alumno,
    'alumno@gmail.com', 'María González', '33456789', '27-33456789-3',
    'PENDING',
    '2026-06-10T09:30:00Z',
    '2026-07-10T09:30:00Z'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    doc_002, uid_alumno,
    'alumno@gmail.com', 'María González', '33456789', '27-33456789-3',
    'SIGNED',
    '2026-05-20T11:00:00Z',
    '2026-06-20T11:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

UPDATE public.signature_requests SET
  viewed_at = '2026-05-22T15:00:00Z',
  signed_at = '2026-05-22T15:45:00Z',
  accepted_conformity = true
WHERE id = '40000000-0000-0000-0000-000000000002';

-- ── SIGNATURES (registro de la firma) ──────────────────────────────

INSERT INTO public.signatures (
  signature_request_id, document_id, signer_email, signer_name,
  document_hash, ip_address, signed_at, metadata
) VALUES (
  '40000000-0000-0000-0000-000000000002',
  doc_002,
  'alumno@gmail.com', 'María González',
  'f6e5d4c3b2a19876543210fedcba9876543210fedcba9876543210fedcba9876',
  '190.120.45.67',
  '2026-05-22T15:45:00Z',
  '{"signatureType":"DIGITAL_CERTIFICATE","otpValidated":true}'::jsonb
);

-- ── AUDIT LOGS ─────────────────────────────────────────────────────

INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at)
VALUES
  (uid_alumno,  'USER_REGISTERED',    'user',               uid_alumno,  '190.120.45.67', 'Mozilla/5.0 (iPhone)', '{}',                                         '2026-05-15T10:00:00Z'),
  (uid_alumno,  'KYC_SUBMITTED',      'identity_verification', kyc_review,'190.120.45.67', 'Mozilla/5.0 (iPhone)', '{}',                                         '2026-06-15T10:05:00Z'),
  (uid_admin,   'KYC_APPROVED',       'identity_verification', kyc_review,'192.168.1.100', 'Mozilla/5.0 (Windows)','{"reviewedBy":"admin@escencial.com"}',        '2026-06-15T11:00:00Z'),
  (uid_admin,   'DOCUMENT_SENT',      'document',           doc_001,     '192.168.1.100', 'Mozilla/5.0 (Windows)','{"signers":1}',                               '2026-06-10T09:30:00Z'),
  (uid_alumno,  'DOCUMENT_VIEWED',    'signature_request',  '40000000-0000-0000-0000-000000000002', '190.120.45.67', 'Mozilla/5.0 (iPhone)', '{"documentId":"30000000-0000-0000-0000-000000000002"}', '2026-05-22T15:00:00Z'),
  (uid_alumno,  'CONFORMITY_ACCEPTED','signature_request',  '40000000-0000-0000-0000-000000000002', '190.120.45.67', 'Mozilla/5.0 (iPhone)', '{"email":"alumno@gmail.com"}',               '2026-05-22T15:40:00Z'),
  (uid_alumno,  'DOCUMENT_SIGNED',    'signature_request',  '40000000-0000-0000-0000-000000000002', '190.120.45.67', 'Mozilla/5.0 (iPhone)', '{"signatureType":"DIGITAL_CERTIFICATE","otpValidated":true}', '2026-05-22T15:45:00Z'),
  (uid_alumno,  'DOCUMENT_COMPLETED', 'document',           doc_002,     '190.120.45.67', 'Mozilla/5.0 (iPhone)', '{}',                                         '2026-05-22T15:45:01Z');

END $$;
