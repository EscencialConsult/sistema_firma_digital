-- Agrega columna para guardar la foto selfie capturada al momento de la firma electrónica
ALTER TABLE signatures
  ADD COLUMN IF NOT EXISTS signing_selfie_url TEXT;
