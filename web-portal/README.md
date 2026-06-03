# Firma Digital - Portal Web

**Aplicación web simple para firmar y descargar documentos PDF** con certificados digitales PKCS#11 (tokens USB).

## 🚀 Características

- ✅ **Carga de PDF** - Sube tu documento en segundos
- ✅ **Preview** - Previsualiza el contenido antes de firmar
- ✅ **Firma digital** - Firma con tu certificado PKCS#11
- ✅ **Descarga** - Obtén tu PDF firmado de inmediato
- ✅ **Privado** - Todo se procesa localmente, sin servidores
- ✅ **Seguro** - Compatible con tokens PKCS#11 (ePass2003, Aladdin eToken, etc.)

## 📋 Requisitos

- Node.js 18+
- npm o yarn
- Backend de firmas corriendo en `http://127.0.0.1:8000`
- Token PKCS#11 conectado (para firmar)

## 🔧 Instalación

```bash
cd web-portal
npm install
```

## 🏃 Ejecutar

### Desarrollo
```bash
npm run dev
```

Accede a `http://localhost:5174`

### Producción
```bash
npm run build
npm run preview
```

## 📡 API esperada

El backend debe exponer un endpoint para firmar:

```
POST /sign
Content-Type: multipart/form-data

Parámetros:
- pdf_file: File
- pin: string

Respuesta:
- Content-Type: application/pdf (el PDF firmado)
```

## 🎯 Flujo de usuario

1. **Landing** → Carga tu PDF
2. **Preview** → Ves el contenido
3. **Firma** → Ingresa tu PIN
4. **Descarga** → Obtén el PDF firmado

## 📦 Estructura

```
src/
├── App.tsx               # Componente principal
├── api.ts                # Funciones de API
├── main.tsx              # Punto de entrada
├── pages/
│   ├── LandingPage.tsx   # Página de inicio y upload
│   └── SigningPage.tsx   # Página de firma y descarga
└── styles.css            # Estilos globales
```

## 🎨 Tecnologías

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Estilos
- **Vite** - Build tool
- **Lucide React** - Iconos

## 🔐 Seguridad

- El PIN **nunca se envía** a ningún servidor
- Los PDFs **no se almacenan** en el servidor
- Todo se procesa **localmente** en tu navegador
- Compatible con **certificados digitales válidos** en Argentina y Latinoamérica

## 📝 Variables de entorno

```env
VITE_API_BASE=http://127.0.0.1:8000  # URL base del backend
```

## 🛠 Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (hot reload)
npm run dev

# Construir para producción
npm run build

# Preview de la build
npm run preview
```

## 📄 Licencia

Mismo del proyecto principal

---

**Listo para usar.** Solo carga tu PDF, ingresa tu PIN y descarga firmado. 🎉
