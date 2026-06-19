-- Vincula una verificación de identidad con la solicitud de firma que la originó
ALTER TABLE public.identity_verifications
  ADD COLUMN IF NOT EXISTS signing_request_id UUID REFERENCES public.signature_requests(id);
