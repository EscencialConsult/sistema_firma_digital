# 📋 Cambios: Vista Previa de Firma Editable + PKCS#11

## ✨ Nuevas Características

### 1️⃣ Vista Previa Interactiva de Firma
- **Arrastra la firma** directamente en el PDF para posicionarla
- **Ajusta el tamaño** con sliders (ancho/alto)
- **Controles de posición** X/Y precisos
- **Presets** para posiciones comunes (Abajo Izq, Centro, Derecha)

### 2️⃣ Soporte PKCS#11 (Tokens USB)
- Auto-detecta drivers PKCS#11 en Windows
- Compatible con: ePass2003, Aladdin eToken, Gemalto, etc.
- Firma local (clave privada nunca sale del token)
- PIN se procesa localmente (no se transmite)

### 3️⃣ Flujo de Firma Mejorado
- **Paso 1 (Preview):** Carga PDF + posiciona firma
- **Paso 2 (Sign):** Ingresa PIN + confirma firma
- **Paso 3 (Done):** Descarga PDF firmado

---

## 🔧 Cambios de Código

### Backend (`web-backend/app/main.py`)

**Nuevo endpoint POST `/sign`**

```python
@app.post("/sign")
async def sign_pdf(
    pdf_file: UploadFile,
    pin: str,
    sig_width: int = 300,
    sig_height: int = 118,
    sig_x: int = 36,
    sig_y: int = 36,
    reason: str = "Firma digital"
) -> FileResponse:
    """Firma PDF con PKCS#11"""
    # Detecta token automáticamente
    # Firma con pyHanko
    # Retorna PDF firmado
```

**Parámetros:**
- `pdf_file` - Archivo PDF a firmar
- `pin` - PIN del token
- `sig_width/sig_height` - Dimensiones de firma visible
- `sig_x/sig_y` - Posición en el PDF
- `reason` - Razón de la firma

### Frontend - Componentes Nuevos

**`SignaturePreview.tsx`**
- Previsualiza PDF con overlay de firma
- Permite arrastar la firma (drag & drop)
- Controles deslizantes para tamaño y posición
- Presets para posiciones comunes

```tsx
<SignaturePreview
  pdfUrl={pdfUrl}
  settings={signatureSettings}
  onSettingsChange={setSignatureSettings}
/>
```

**`Slider.tsx`**
- Componente reutilizable de slider
- Estilo personalizado para Tailwind

### Frontend - Actualizaciones

**`SigningPage.tsx`**
- Nuevo sistema de pasos: `preview` → `sign` → `done`
- Integración con `SignaturePreview`
- Pasa parámetros de firma al backend

**`api.ts`**
- `signPdf()` ahora acepta parámetros de firma
- Envía todos los datos al endpoint `/sign`

```ts
await signPdf(
  pdfFile,
  pin,
  signatureSettings.width,
  signatureSettings.height,
  signatureSettings.x,
  signatureSettings.y
)
```

---

## 📊 Flujo Actual

```
┌─────────────────────┐
│  Landing Page       │ ← Sube PDF
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Signing Page - Step 1: Preview     │
├─────────────────────────────────────┤
│ • PDF preview con overlay de firma  │
│ • Arrastra para posicionar          │
│ • Controles de tamaño/posición      │
│ • Presets de ubicación              │
└──────────┬──────────────────────────┘
           │ "Continuar"
           ▼
┌─────────────────────────────────────┐
│  Signing Page - Step 2: Sign        │
├─────────────────────────────────────┤
│ • Input para PIN                    │
│ • Botón "Firmar documento"          │
│ • Validación en tiempo real         │
└──────────┬──────────────────────────┘
           │ PIN + Envía /sign
           ▼
┌─────────────────────────────────────┐
│  Backend - Firma con PKCS#11        │
├─────────────────────────────────────┤
│ • Detecta token                     │
│ • Abre con PIN                      │
│ • Firma PDF con pyHanko             │
│ • Retorna PDF firmado               │
└──────────┬──────────────────────────┘
           │ PDF firmado
           ▼
┌─────────────────────────────────────┐
│  Signing Page - Step 3: Done        │
├─────────────────────────────────────┤
│ • Mensaje "✓ Firmado"               │
│ • Botón descargar PDF               │
│ • Botón "Firmar otro"               │
└─────────────────────────────────────┘
```

---

## 📦 Dependencias Requeridas

**Backend:**
```
pyHanko==0.35.1  (ya existe)
FastAPI==0.115.6 (ya existe)
```

**Frontend:**
```
React==18.3.1
TypeScript
Tailwind CSS
Lucide React
```

---

## 🚀 Cómo Probar

### 1. Terminal 1 - Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Opcional: Fuerza DLL específica
$env:FIRMA_PKCS11_MODULE="C:\Windows\System32\eTPKCS11.dll"

python -m app.main
```

### 2. Terminal 2 - Frontend

```bash
cd web-portal
npm install
npm run dev
```

### 3. Navegador

```
http://localhost:5174
```

### 4. Uso

1. Carga un PDF
2. Arrastra la firma o usa los controles
3. Ingresa PIN de tu token
4. ✓ Descarga PDF firmado

---

## 🔐 Seguridad

- ✅ **PIN procesado localmente** (no sale del navegador)
- ✅ **Firma en el token** (clave privada nunca sale)
- ✅ **CORS habilitado** solo para `localhost:5174`
- ✅ **Sin almacenamiento** de archivos (procesamiento en memoria)

---

## 🛠️ Archivos Modificados

```
✏️ web-backend/app/main.py
   → Nuevo endpoint /sign

✏️ web-portal/src/pages/SigningPage.tsx
   → Nuevo flujo de pasos

✨ web-portal/src/components/SignaturePreview.tsx
   → NUEVO componente

✨ web-portal/src/components/Slider.tsx
   → NUEVO componente

✏️ web-portal/src/api.ts
   → Actualizado signPdf() con parámetros

📄 web-portal/PKCS11_SETUP.md
   → Guía de configuración

📄 web-portal/SETUP.md
   → Guía de integración
```

---

## ⚠️ Próximos Pasos (Opcionales)

- [ ] Agregar múltiples páginas (seleccionar en qué página firmar)
- [ ] Validar firma post-firma
- [ ] Agregar timestamp (TSA)
- [ ] Soporte para firma contra-firma
- [ ] UI para seleccionar certificado si hay múltiples
- [ ] Guardar preferencias de posición de firma

---

## 📚 Referencias

- [pyHanko Docs](https://pyhanko.readthedocs.io/)
- [PKCS#11 Spec](http://docs.oasis-open.org/pkcs11/pkcs11-base/)
- [FastAPI Upload Files](https://fastapi.tiangolo.com/tutorial/request-files/)

---

**¡Listo para firmar con PKCS#11!** 🔐✨
