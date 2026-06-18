-- Habilitar Supabase Realtime para la tabla identity_verifications
-- Esto permite que el frontend escuche los cambios en tiempo real en lugar de hacer polling.

begin;
  -- Add the table to the realtime publication
  alter publication supabase_realtime add table public.identity_verifications;
commit;
