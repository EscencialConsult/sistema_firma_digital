# Firma Flow — Sistema Firma Digital

> Ver también: [[Arquitectura]] | [[KYC_Flow]] | [[Edge_Functions]] | [[Contratos]]

## Los 4 pasos del flujo de firma (`SigningFlowPage.tsx`)

```
Step 0 — Conformidad legal
Step 1 — Verificación facial
Step 2 — Tu firma (canvas)
Step 3 — Confirmación + auditoría
```

---

### Step 0 — Conformidad legal

**UI:**
- Renderiza el documento completo con `<ContractDocument>` (template + variables)
- Muestra hash SHA-256 (primeros 16 chars) en el encabezado
- Botón "Descargar PDF" (jsPDF client-side)
- Texto legal invocando Ley 25.506 Argentina
- Checkbox obligatorio para habilitar "Aceptar y continuar"

**DB:**
- `INSERT INTO conformity_acceptances { signature_request_id, user_id, acceptance_text, user_agent }`
- `UPDATE signature_requests SET status = 'CONFORMITY_ACCEPTED', accepted_conformity = true`

**Lógica:** Si al cargar la página ya tiene `acceptedConformity = true`, salta directamente al Step 1.

---

### Step 1 — Verificación facial

**UI:**
- Activa webcam con `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })`
- Preview en espejo (CSS `scale-x-[-1]`). Al capturar, se desmirroriza via canvas transform
- "Capturar Foto" → preview → "Confirmar y verificar" o "Volver a tomar"
- En error: muestra porcentaje de similitud

**Verificación → Edge Function `face-verify`:**
1. Frontend envía base64 del JPEG capturado (sin el prefijo data URL)
2. Edge Function busca el usuario por `signer_email` del `signature_request`
3. Descarga selfie KYC desde `kyc-documents` bucket
4. Llama **AWS Rekognition `CompareFaces`** con umbral 90%:
   - Source: selfie capturada ahora
   - Target: selfie del KYC registrado

**Fallbacks (siempre aprueba):**
- Sin credenciales AWS → mock: `{ similarity: 96.4, verified: true, mock: true }`
- Sin KYC registrado → `{ similarity: 0, verified: true, noKyc: true }`
- Sin selfie KYC → `{ similarity: 0, verified: true, noSelfie: true }`

**Al pasar:** Sube selfie a `kyc-documents/signing-selfies/{requestId}.jpg`, guarda URL en estado, avanza a Step 2.

---

### Step 2 — Firma manuscrita (canvas)

**UI:**
- Canvas 220px de alto, full width, `cursor-crosshair`
- **PointerEvents API** (maneja mouse, touch, stylus con `setPointerCapture`)
- Configuración: `lineWidth: 2.5`, `lineCap: round`, `strokeStyle: #18181b`
- Botón "Limpiar" resetea canvas y `hasStrokes = false`
- "Confirmar firma" habilitado solo cuando `hasStrokes = true`

**GOTCHA:** Las dimensiones del canvas NO usan `devicePixelRatio` (comentario en código: "Using devicePixelRatio here can offset strokes"). En displays retina, las trazos son de menor resolución. Es intencional.

**Al confirmar:** `canvas.toDataURL("image/png")` → PNG completo como data URL (`data:image/png;base64,...`)

---

### Transición Step 2 → 3: `executeSignature()`

Secuencia atómica en `signing.service.ts`:

1. Obtiene IP pública via `https://api.ipify.org?format=json` (silencioso si falla)
2. `INSERT INTO signatures`:
   - `signature_data`: PNG data URL completo
   - `signature_method: "CANVAS"`
   - `face_similarity_score`: número (ej: 96.4)
   - `face_verification_method: "LOCAL_WEBCAM"`
   - `signing_selfie_url`: URL pública en Storage
   - `document_hash`: SHA-256 del PDF, o `manual-signature:{requestId}:{date}` si no hay PDF
3. `UPDATE signature_requests SET status = 'SIGNED', signed_at = now()`
4. `INSERT INTO audit_logs { action: "DOCUMENT_SIGNED", metadata: { method: "CANVAS+FACIAL" } }`

**Fire-and-forget después:**
- `generatePerSignerSignedPdf(documentId)` — agrega hoja de firmas al PDF original
- `tryGenerateConsolidatedPdf(documentId)` — si todos firmaron, genera PDF final completo

---

### Step 3 — Confirmación + Auditoría

**UI:**
- Banner de éxito con colores de la marca
- `<SignedContractAudit>` muestra:
  - Contrato renderizado con firma incrustada inline
  - Botón "Descargar PDF" (solo contrato)
  - Botón "Con auditoría" (contrato + certificado legal)
  - Panel colapsable con: datos del firmante, IP, timestamp, similitud facial %, selfie, hash SHA-256
  - Checklist: "Conformidad aceptada ✓", "Verificación facial ✓", "OTP validado ✓", "Firma manuscrita ✓"

**GOTCHA:** "OTP de identidad validado" aparece siempre como ✓ aunque en `SigningFlowPage` NO se envía ni verifica ningún OTP. OTP solo existe en el flujo alternativo `PublicSigningPage`.

---

## Sistema OTP (`otp_challenges`)

OTP implementado y activo en el flujo **`PublicSigningPage`** (acceso público por token), no en el flujo autenticado principal.

```sql
otp_challenges
  ├── id
  ├── signature_request_id
  ├── code_hash  -- bcrypt, nunca plain text
  ├── expires_at -- now() + 10 minutos
  ├── used       -- true después de verificar (single-use)
  └── created_at
```

RLS: `USING (false)` — completamente bloqueado. Solo accesible via funciones `SECURITY DEFINER`.

**Generación:** RPC `generate_otp()` → genera 6 dígitos, bcrypt hash, INSERT. Devuelve plain code solo al Edge Function `send-signing-email` que lo envía por email via **Resend API** y lo descarta.

**Verificación:** RPC `verify_otp()` → busca challenge no usado y no vencido, `crypt(input, hash) = hash` → marca `used = true` y retorna true.

---

## Verificación facial — dos métodos

| Método | Estado | Cómo funciona |
|---|---|---|
| **Local Webcam** (`face-verify` EF) | Activo | Webcam → AWS Rekognition CompareFaces vs selfie KYC |
| **DIDIT Redirect** (`face-verify-signing` EF) | Legacy/inactivo | Redirige a DIDIT → vuelve con `?face_verified=ok\|failed` |

El método DIDIT sigue en el código (useEffect en SigningFlowPage detecta el param URL), pero la UI de Step 1 siempre usa webcam local.

---

## Generación de PDFs

### `generatePerSignerSignedPdf()` — por cada firma
Fire-and-forget inmediatamente después de cada firma.

1. Descarga el PDF original (versión 1, `version_number ASC`)
2. Agrega página "HOJA DE FIRMAS" con pdf-lib:
   - Por cada firmante: PNG de firma (150×45px), línea, nombre, fecha, "Ley 25.506"
   - Si hay overflow: agrega "HOJA DE FIRMAS (Cont.)"
3. Calcula SHA-256 del nuevo PDF
4. Sube a `contract-pdfs/{documentId}/signed_v{N}_{safeName}`
5. INSERT nuevo `document_versions`

### `tryGenerateConsolidatedPdf()` — cuando todos firmaron
Fire-and-forget, genera el PDF final consolidado.

1. Obtiene todos los `signature_requests` con `status = 'SIGNED'`
2. **Prepend autoridad**: si `template_fields.autoridad_signature_url` existe, la pone primero en el array de firmantes
3. Con PDF original: agrega hoja de firmas + página de certificado con jsPDF
4. Sin PDF original: genera todo el documento con jsPDF desde `template_fields._templateContent`
5. Página de certificado incluye: título, doc ID, timestamp, bloques por firmante, sello "FIRMA ELECTRONICA VALIDA - Ley 25.506"
6. Sube a `signed-contracts/{org_id}/{doc_id}/firmado.pdf` (upsert)
7. UPDATE `documents.final_pdf_url` con URL pública

---

## `signature_data` — el dato central

- **Qué es:** PNG data URL completo: `data:image/png;base64,iVBORw0...`
- **Cómo se genera:** `canvas.toDataURL("image/png")` — fondo transparente, trazos negros (#18181b)
- **Cómo se guarda:** TEXT column en `signatures.signature_data`
- **Cómo se usa:** `<img src={signatureData}>` en vistas de auditoría. En pdf-lib: `pdfDoc.embedPng(signatureData)` directo (acepta data URL)

---

## Modelo de datos

```
documents
  └── document_versions (1..N → PDF en storage + sha256)
  └── signature_requests (1..N por firmante)
        └── conformity_acceptances (1)
        └── otp_challenges (1..N, solo PublicSigningPage)
        └── signatures (1 cuando se firma)
        └── identity_verifications (por DIDIT KYC, no por firma)
```

---

## Autoridades de organización

Para que un admin pueda crear contratos, su org necesita al menos 1 autoridad con `status = 'ACTIVE'`.

| Tipo | Flujo |
|---|---|
| `PERMANENT` | Admin crea → autoridad recibe email → acepta en `/authority/accept/:token` → `status = ACTIVE` |
| `PROVISIONAL` | Admin crea → se genera convenio (documento) → autoridad firma convenio → `status = ACTIVE` |

---

## Gotchas importantes

1. **"OTP validado ✓" es falso en SigningFlowPage** — se muestra en auditoría pero nunca se procesa OTP en ese flujo
2. **Dos flujos incompatibles escriben en las mismas tablas** — `executeSignature()` (servicio) vs `sign-document` Edge Function. No usar ambos para el mismo documento
3. **`sign-document` EF hardcodea `version_number: 2`** — falla si ya existe versión 2 (p. ej., si `generatePerSignerSignedPdf` corrió antes)
4. **Fallbacks de face-verify siempre aprueban** — sin AWS keys o sin KYC registrado, pasa igual. No hay enforcement en prod mode
5. **Autoridad en PDF consolidado requiere URL pública** — `autoridad_signature_url` se fetcha desde el browser; si es Storage privado, se omite silenciosamente
6. **Expiración del request solo se chequea en el cliente** — `executeSignature` y `verifyFaceLocal` no re-validan expiración server-side
