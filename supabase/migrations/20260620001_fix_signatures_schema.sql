-- ─── Fix: tabla signatures con signature_data ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES public.users(id),
  ip_address            TEXT,
  user_agent            TEXT,
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_method      TEXT NOT NULL DEFAULT 'CANVAS',
  signature_data        TEXT,   -- base64 PNG del canvas de firma manuscrita
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS signature_data   TEXT,
  ADD COLUMN IF NOT EXISTS signature_method TEXT DEFAULT 'CANVAS',
  ADD COLUMN IF NOT EXISTS user_agent       TEXT,
  ADD COLUMN IF NOT EXISTS ip_address       TEXT,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── Fix: tabla conformity_acceptances ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conformity_acceptances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES public.users(id),
  acceptance_text       TEXT,
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS signatures ───────────────────────────────────────────────────────────
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own signature" ON public.signatures;
CREATE POLICY "Users can insert their own signature"
ON public.signatures FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view signatures" ON public.signatures;
CREATE POLICY "Admins can view signatures"
ON public.signatures FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ORG_ADMIN')
  OR user_id = auth.uid()
);

-- Permitir insert anónimo (firmantes sin cuenta)
DROP POLICY IF EXISTS "Anon can insert signature" ON public.signatures;
CREATE POLICY "Anon can insert signature"
ON public.signatures FOR INSERT
TO anon
WITH CHECK (true);

-- ─── RLS conformity_acceptances ───────────────────────────────────────────────
ALTER TABLE public.conformity_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert conformity" ON public.conformity_acceptances;
CREATE POLICY "Anyone can insert conformity"
ON public.conformity_acceptances FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view conformity" ON public.conformity_acceptances;
CREATE POLICY "Admins can view conformity"
ON public.conformity_acceptances FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ORG_ADMIN')
  OR user_id = auth.uid()
);

-- ─── Fix: documents.completed_signers y status COMPLETED ─────────────────────
-- Trigger: cuando un signature_request cambia a SIGNED, actualiza el documento
CREATE OR REPLACE FUNCTION public.handle_signature_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total     INTEGER;
  v_completed INTEGER;
BEGIN
  IF NEW.status = 'SIGNED' AND OLD.status <> 'SIGNED' THEN
    -- Incrementar completed_signers
    UPDATE public.documents
    SET completed_signers = completed_signers + 1
    WHERE id = NEW.document_id
    RETURNING total_signers, completed_signers
    INTO v_total, v_completed;

    -- Si todos firmaron → COMPLETED
    IF v_completed >= v_total THEN
      UPDATE public.documents
      SET status = 'COMPLETED'
      WHERE id = NEW.document_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_signature_request_signed ON public.signature_requests;
CREATE TRIGGER on_signature_request_signed
AFTER UPDATE ON public.signature_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_signature_completed();
