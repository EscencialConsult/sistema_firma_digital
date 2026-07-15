-- ============================================================================
-- Multi-org memberships
--
-- Permite que un usuario pertenezca a más de una organización.
-- La relación primary users.organization_id se mantiene intacta (sin romper
-- RLS existente ni el JWT hook). Esta tabla es la capa adicional.
-- ============================================================================

-- ─── 1. Tabla principal de membresías ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'pending', 'rejected')),
  role            TEXT NOT NULL DEFAULT 'USER'
                    CHECK (role IN ('USER', 'ADMIN', 'ORG_ADMIN')),
  invited_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_memberships_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_memberships_updated_at();

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id  ON public.organization_memberships (organization_id);

-- ─── 2. Tabla de invitaciones por email ──────────────────────────────────────
-- Admin invita a un usuario existente por su email. Se genera un token único.
-- El usuario recibe el link /invite/:token y al aceptarlo se crea la membresía.

CREATE TABLE IF NOT EXISTS public.org_user_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, organization_id)   -- solo una invitación activa por email+org
);

CREATE INDEX IF NOT EXISTS idx_invitations_token  ON public.org_user_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email  ON public.org_user_invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON public.org_user_invitations (organization_id);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_user_invitations     ENABLE ROW LEVEL SECURITY;

-- organization_memberships: cada usuario ve sus propias membresías.
-- Admins y SUPER_ADMIN ven las de su org.
DROP POLICY IF EXISTS "memberships_self"       ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships_org_admin"  ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships_super"      ON public.organization_memberships;

CREATE POLICY "memberships_self" ON public.organization_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "memberships_org_admin" ON public.organization_memberships
  FOR ALL USING (
    auth.jwt() ->> 'user_role' IN ('ADMIN', 'ORG_ADMIN') AND
    organization_id::text = auth.jwt() ->> 'organization_id'
  );

CREATE POLICY "memberships_super" ON public.organization_memberships
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'SUPER_ADMIN');

-- INSERT para el propio usuario (aceptar invitación crea su membresía)
CREATE POLICY "memberships_self_insert" ON public.organization_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- org_user_invitations: admins gestionan invitaciones de su org.
-- Cualquier usuario autenticado puede leer una invitación por token (para aceptarla).
DROP POLICY IF EXISTS "invitations_admin"  ON public.org_user_invitations;
DROP POLICY IF EXISTS "invitations_super"  ON public.org_user_invitations;
DROP POLICY IF EXISTS "invitations_token"  ON public.org_user_invitations;

CREATE POLICY "invitations_admin" ON public.org_user_invitations
  FOR ALL USING (
    auth.jwt() ->> 'user_role' IN ('ADMIN', 'ORG_ADMIN') AND
    organization_id::text = auth.jwt() ->> 'organization_id'
  );

CREATE POLICY "invitations_super" ON public.org_user_invitations
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'SUPER_ADMIN');

-- Lectura pública de token (para la página /invite/:token sin estar logueado)
CREATE POLICY "invitations_token" ON public.org_user_invitations
  FOR SELECT USING (true);

-- ─── 4. Función helper: count orgs activas de un usuario ─────────────────────
-- Usada en el frontend para detectar si es multi-org y ajustar el tema.

CREATE OR REPLACE FUNCTION public.get_my_org_count()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.organization_memberships
  WHERE user_id = auth.uid() AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_org_count() TO authenticated;

-- ─── 5. Signature_requests: los firmantes deben poder ver sus propias filas ──
-- (independientemente de su org en el JWT)

DROP POLICY IF EXISTS "signer_can_see_own_requests" ON public.signature_requests;
CREATE POLICY "signer_can_see_own_requests" ON public.signature_requests
  FOR SELECT USING (signer_id = auth.uid());
