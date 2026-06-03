# 🔧 Setup - Integración Backend + Frontend

Guía para conectar el **web-portal** con el **backend** de firmas.

## 📡 Endpoint requerido en Backend

El backend Python debe tener este endpoint:

```python
@app.post("/sign")
async def sign_pdf(pdf_file: UploadFile, pin: str) -> StreamingResponse:
    """
    Firma un PDF con certificado PKCS#11
    
    Args:
        pdf_file: Archivo PDF a firmar
        pin: PIN del token PKCS#11
        
    Returns:
        PDF firmado como descarga
    """
    try:
        # 1. Detectar token
        # 2. Abrir token con PIN
        # 3. Leer y firmar PDF
        # 4. Retornar PDF firmado
        
        signed_pdf = await sign_with_token(pdf_file, pin)
        
        return StreamingResponse(
            signed_pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=signed.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## ✅ Checklist de Backend

- [ ] FastAPI corriendo en `http://127.0.0.1:8000`
- [ ] CORS habilitado para `http://localhost:5174`
- [ ] Endpoint `/sign` implementado
- [ ] Token PKCS#11 conectado y detectado
- [ ] Dependencias instaladas: `pyHanko`, `python-pkcs11`

### Habilitar CORS

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## ✅ Checklist de Frontend

- [ ] Node.js 18+ instalado
- [ ] `npm install` ejecutado en `web-portal/`
- [ ] `.env` configurado (opcional, por defecto usa `http://127.0.0.1:8000`)
- [ ] `npm run dev` en `web-portal/`
- [ ] Navegador abierto en `http://localhost:5174`

## 🧪 Test de conexión

### Desde la terminal (curl)

```bash
# 1. Crea un test PDF simple
echo "%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF" > test.pdf

# 2. Test sin PIN (verifica que el endpoint existe)
curl -F "pdf_file=@test.pdf" -F "pin=1234" http://127.0.0.1:8000/sign
```

### Desde el navegador

1. Abre `http://localhost:5174`
2. Carga un PDF de prueba
3. Ingresa tu PIN
4. Verifica en DevTools (F12) que la solicitud llega sin CORS errors

## 🔐 Flujo seguro

```
┌─────────────┐
│  Web Portal │
│  (navegador)│
└──────┬──────┘
       │ POST /sign
       │ FormData: { pdf_file, pin }
       │
       ▼
┌─────────────────┐
│ Backend Python  │
│  (FastAPI)      │
└──────┬──────────┘
       │ Detecta Token PKCS#11
       │ Abre con PIN
       │ Firme pyHanko
       │
       ▼
┌──────────────────┐
│  Token USB       │
│ (PKCS#11)        │
│ • PIN verificado │
│ • Firma en token │
│ • Clave privada  │
│   nunca sale     │
└──────────────────┘
       │
       │ PDF firmado (sin PIN)
       ▼
┌─────────────┐
│ Web Portal  │
│ • Descarga  │
└─────────────┘
```

## 🚨 Troubleshooting

### "CORS error"
```
Access to XMLHttpRequest at 'http://127.0.0.1:8000/sign' from origin 
'http://localhost:5174' has been blocked by CORS policy.
```

**Solución:** Agrega CORS al backend (ver arriba)

### "404 Not Found /sign"
```
POST http://127.0.0.1:8000/sign 404
```

**Solución:** El endpoint no existe. Implementalo en `backend/app/main.py`

### "Backend no responde"
```
Failed to fetch
```

**Solución:**
- Verifica que `http://127.0.0.1:8000` esté corriendo
- Abre en navegador: `http://127.0.0.1:8000/docs` (debería mostrar Swagger)

### "PIN incorrecto"
```
Error al firmar: PIN incorrecto
```

**Solución:**
- Verifica el PIN en el token
- Prueba manualmente en app desktop
- El PIN se envía al token, no al servidor

## 📝 Logging

### Backend - Ver peticiones

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.post("/sign")
async def sign_pdf(pdf_file: UploadFile, pin: str):
    logger.debug(f"Solicitud de firma: {pdf_file.filename}, PIN length: {len(pin)}")
    # ...
```

### Frontend - Ver en DevTools

Abre `http://localhost:5174` → F12 → Network → Carga PDF → Mira la solicitud POST

## ✨ Listo

Cuando todo funcione:

1. Portal carga PDF
2. Ingresas PIN  
3. Ves:
   ```
   POST /sign 200 OK
   Content-Type: application/pdf
   [Descarga se inicia]
   ```
4. ¡PDF firmado!

---

**Más ayuda:** Revisa `backend/README.md` y `web-portal/README.md`
