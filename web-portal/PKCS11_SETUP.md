# 🔐 Guía: Firmar con PKCS#11 (Token USB)

## 📋 Requisitos

1. **Token PKCS#11** conectado a USB (ePass2003, Aladdin eToken, Gemalto, etc.)
2. **Driver PKCS#11** instalado en Windows
3. **PIN del token** (normalmente 6-8 dígitos)
4. **Certificado digital** válido en el token

---

## 🔍 Verificar que tu token está detectado

### 1. Verificar en Windows

```powershell
# Abre Device Manager (Administrador de dispositivos)
devmgmt.msc

# Busca tu token en "Lectores de tarjetas inteligentes" o "Dispositivos de seguridad"
# Debería aparecer algo como:
# - ePass2003 USB Token
# - Aladdin eToken
# - Gemalto USB Token
```

### 2. Buscar la DLL del driver PKCS#11

Depends del token:

| Token | DLL usual | Ruta |
|-------|-----------|------|
| **ePass2003** | `eTPKCS11.dll` | `C:\Windows\System32\` |
| **Aladdin eToken** | `aetpkss.dll` | Carpeta de instalación Aladdin |
| **Gemalto** | `gclib.dll` | Carpeta de instalación |
| **SCR3x00** | `ScriptedCrypto.dll` | `C:\Windows\System32\` |

**En terminal (PowerShell):**

```powershell
# Buscar eTPKCS11.dll (ePass)
Get-ChildItem -Path "C:\Windows\System32" -Filter "eTPKCS11.dll" -Recurse -ErrorAction SilentlyContinue

# Buscar archivos PKCS#11 en Program Files
Get-ChildItem -Path "C:\Program Files*" -Filter "*pkcs*.dll" -Recurse -ErrorAction SilentlyContinue 2>$null
```

---

## 🚀 Probar firma con el portal web

### 1. Inicia el backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Si necesitas forzar una DLL específica
$env:FIRMA_PKCS11_MODULE="C:\Windows\System32\eTPKCS11.dll"

python -m app.main
```

**Debería mostrar:**
```
✓ Token detectado: eTPKCS11.dll
✓ Escuchando en http://127.0.0.1:8000
```

### 2. Inicia el portal web

```bash
cd web-portal
npm install
npm run dev
```

Abre: **`http://localhost:5174`**

### 3. Prueba la firma

1. **Carga un PDF** de prueba
2. **Posiciona la firma** (arrastra o edita con controles)
3. **Ingresa tu PIN** del token
4. ✅ **Descarga el PDF firmado**

---

## 🔧 Troubleshooting PKCS#11

### Error: "No se detectó token PKCS#11"

**Causa:** El driver no está instalado o no se encuentra

**Solución:**

```powershell
# 1. Verifica que la DLL existe
Test-Path "C:\Windows\System32\eTPKCS11.dll"

# 2. Si el resultado es False, instala el driver del token
# Busca: "ePass2003 driver Windows" o similar según tu token

# 3. Si tienes la DLL pero no se detecta, fuerza la ruta
$env:FIRMA_PKCS11_MODULE="C:\full\path\to\eTPKCS11.dll"
python -m app.main
```

### Error: "PIN incorrecto"

**Causa:** El PIN que ingresaste no coincide con el del token

**Solución:**

1. Verifica tu PIN (normalmente viene en la tarjeta del token)
2. Intenta con el PIN del certificado (a veces es diferente del PIN del token)
3. Prueba con el PIN en otro software compatible (OpenSC, Mozilla Firefox, etc.)

**Para ver el PIN del token (requiere herramientas OpenSC):**

```bash
# Si tienes OpenSC instalado
pkcs11-tool --list-slots
pkcs11-tool --login --list-objects
```

### Error: "No hay certificado válido"

**Causa:** El token no tiene un certificado de firma o expiró

**Solución:**

1. Contacta a tu CA (autoridad certificadora) para renovar
2. Verifica en software del token (ej: eToken Manager para Aladdin)
3. Intenta importar un certificado P12 (si tienes uno)

### Error: "Access denied" o "Acceso denegado"

**Causa:** El driver necesita permisos administrativos

**Solución:**

```powershell
# Ejecuta PowerShell como Administrador y vuelve a intentar
python -m app.main
```

---

## 📝 Ejemplos de PINs comunes

| Token | PIN común |
|-------|----------|
| **ePass2003** | `123456` (por defecto) |
| **Aladdin eToken** | Lo que configures (típicamente 6-8 dígitos) |
| **Gemalto** | `123456` (por defecto) |

⚠️ **Cambiar el PIN es seguro - se recomienda usar uno único**

---

## 🔍 Ver certificados en el token

### Con OpenSC (herramienta libre)

```bash
# Instalar OpenSC en Windows
# https://github.com/OpenSC/OpenSC/releases

# Listar certificados
pkcs11-tool --login --list-objects --type cert

# Ver detalles
pkcs11-tool --login --read-object --type data --id 0001
```

### Con software nativo del token

- **ePass2003**: ePass2003 Token Management Tools
- **Aladdin eToken**: eToken Manager
- **Gemalto**: Gemalto Smart Card COM

---

## ✅ Flujo de firma paso a paso

```
1. Token conectado → ✓ Detectado en USB
   ↓
2. Driver PKCS#11 → ✓ DLL encontrada
   ↓
3. Backend inicia → ✓ Escucha en :8000
   ↓
4. Frontend abre → ✓ Carga en localhost:5174
   ↓
5. Usuario carga PDF → ✓ Previsualizado
   ↓
6. Posiciona firma → ✓ Editable visualmente
   ↓
7. Ingresa PIN → ✓ Se envía al backend
   ↓
8. Backend → Token → ✓ Firma localmente
   ↓
9. Download PDF → ✓ Archivo firmado
```

---

## 🔐 Seguridad

- ✅ El **PIN nunca se guarda**
- ✅ El **PIN se envía directo al backend** (no a internet)
- ✅ La **firma ocurre en el token** (clave privada nunca sale)
- ✅ El **PDF se procesa localmente**
- ✅ Compatible con **certificados **válidos en Argentina, Chile, Uruguay, etc.

---

## 📞 Soporte

Si tienes problemas:

1. Revisa el log del backend: `python -m app.main 2>&1 | tee log.txt`
2. Verifica que el token aparece en Device Manager
3. Intenta con otro software compatible (Firefox, Adobe Reader)
4. Contacta al proveedor del token para verificar el driver

---

**¡Listo!** Ahora puedes firmar documentos con seguridad. 🎉
