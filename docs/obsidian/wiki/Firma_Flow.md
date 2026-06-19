# Firma Flow — Sistema Firma Digital

> Ver también: [[Arquitectura]] | [[KYC_Flow]] | [[Edge_Functions]]

## Flujo completo de firma

```
Admin crea documento → sube PDF → genera SHA256 → crea signature_requests
  ↓
Firmante recibe link /signing/:id (con JWT propio o token público)
  ↓
SigningFlowPage — 3 pasos:
  Step 0: Conformidad (leer doc + aceptar términos de firma)
    → INSERT conformity_acceptances
    → UPDATE signature_requests SET status='CONFORMITY_ACCEPTED'
  Step 1: Verificación facial (DIDIT redirect)
    → face-verify-signing edge fn
    → redirect a DIDIT → vuelve con ?face_verified=ok|failed
  Step 2: Firma
    → OTP enviado al email del firmante
    → Canvas de firma manuscrita
    → INSERT signatures con signature_data (base64 PNG)
    → UPDATE signature_requests SET status='SIGNED'
    → tryGenerateConsolidatedPdf() — silencioso
```

## Documento COMPLETED

Cuando todos los `signature_requests` de un documento pasan a `SIGNED`:
- `documents.status` → `COMPLETED`
- `tryGenerateConsolidatedPdf()` genera PDF con jsPDF
  - Header negro con logo
  - Por cada firmante: nombre, email, fecha, imagen de firma
  - Bloque legal al final
  - Sube a `signed-contracts/{org_id}/{doc_id}/firmado.pdf`
  - Guarda URL en `documents.final_pdf_url`

## Servicios involucrados

### `signing.service.ts`
| Función | Descripción |
|---|---|
| `getMySigningRequests(email)` | Mis solicitudes de firma como firmante |
| `getSigningRequest(id)` | Una solicitud con documento y versiones |
| `acceptConformity(requestId, text)` | Step 0 de firma |
| `executeSignature(requestId, metadata)` | Step 2 — inserta firma y actualiza estado |
| `initiateFaceVerificationDIDIT(requestId)` | Llama face-verify-signing, retorna URL DIDIT |
| `tryGenerateConsolidatedPdf(documentId)` | Genera y sube PDF si el doc está COMPLETED |
| `rejectSigning(requestId)` | Rechaza la solicitud |

### `contracts.service.ts`
| Función | Descripción |
|---|---|
| `getMyContracts()` | Contratos del org del usuario logueado |
| `createContract(data)` | Crea documento + sube PDF + crea signature_requests |
| `sendDocumentToThirdParty(docId, signer)` | Agrega firmante extra a doc COMPLETED |

## Admin — flujo desde panel

- **Nuevo contrato:** requiere `hasActiveAuthority` (la org tiene al menos 1 autoridad ACTIVE)
- **Enviar al tercero:** solo en contratos COMPLETED — crea nuevo signature_request
- **PDF firmado:** botón verde "PDF" aparece cuando `contract.finalPdfUrl` existe

## Modelo de datos firma

```
documents
  └── document_versions (1..N, tiene PDF en storage + sha256)
  └── signature_requests (1..N por firmante)
        └── conformity_acceptances (1)
        └── otp_challenges (1..N)
        └── signatures (1 cuando se firma)
        └── identity_verifications (por facial via face-verify-signing)
```

## Autoridades de organización

Para que un admin pueda crear contratos, su organización necesita al menos 1 autoridad con `status = 'ACTIVE'`.

Tipos:
- `PERMANENT`: Persona física autorizada indefinidamente
- `PROVISIONAL`: Autoridad temporal — requiere firma de un convenio (documento)

Estados: `PENDING`, `ACTIVE`, `REVOKED`

Tabla: `organization_authorities`
- `organization_id`, `type`, `status`
- `document_id` → enlace al convenio que activa la autoridad PROVISIONAL
- `signing_request_id` → firma específica del convenio
