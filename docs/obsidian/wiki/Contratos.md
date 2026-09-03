# Contratos — Sistema Firma Digital

> Ver también: [[Firma_Flow]] | [[Organizaciones]] | [[Arquitectura]]

## Tipos de contrato

| Tipo | Descripción |
|---|---|
| **Desde plantilla HTML** | Editor TipTap con variables. El admin rellena vars, se genera PDF al enviar. |
| **PDF directo** | Admin sube un PDF existente. Se procesa con pagedjs + firma. |

## Plantillas HTML (`contract_templates`)

```sql
contract_templates
  ├── id
  ├── organization_id
  ├── name
  ├── content_html       → HTML con variables entre {{llaves}}
  ├── description
  ├── logo_header        → boolean, muestra logo en encabezado del PDF
  ├── logo_watermark     → boolean, muestra watermark en el PDF
  └── type: 'HTML' | 'PDF'
```

## Sistema de variables en plantillas

Las plantillas usan la sintaxis `{{nombre_variable}}`. Hay dos categorías:

### Variables de admin (manuales)

El admin las completa en el formulario antes de enviar. Ejemplos:
- `{{nombre_firmante}}`, `{{dni_firmante}}`, `{{monto}}`, `{{fecha_inicio}}`

Detectadas automáticamente leyendo el `contentHtml` con regex `/\{\{([^}]+)\}\}/g`, excluyendo las de empresa.

### Variables de empresa (semi-automáticas)

Se pre-completan desde la configuración de la org. El admin puede editarlas o restaurarlas.

**Set completo (`ORG_VARS` en `AdminContractsPage.tsx`):**

```
razon_social         → org.name
nombre_empresa       → org.name
cuit_empresa         → org.cuilCuit
cuit_consultora      → org.cuilCuit
email_empresa        → org.contactEmail
telefono_empresa     → org.phone
direccion_empresa    → org.address
ciudad_empresa       → org.city
provincia_empresa    → org.province
representante_legal  → selectedAuth?.fullName (autoridad seleccionada)
```

**Flujo en el formulario:**

1. Al abrir el formulario de envío, `orgAutoVars` filtra las vars de empresa que aparecen en la plantilla
2. Un `useEffect` pre-rellena `varValues` con los datos reales de `orgData`
3. Se muestra sección azul "Datos de la empresa" con inputs editables
4. Si el admin edita un campo → aparece chip `↩ Restaurar: [valor original]`
5. Al hacer click en chip → restaura el valor de org
6. Al enviar → `varValues` (con todos los valores, editados o no) va en `templateFields`

**GOTCHA:** Si `varValues` no incluye las `orgAutoVars` en su inicialización, las variables de empresa llegan vacías al PDF. Siempre inicializar ambos conjuntos juntos.

## Flujo de envío de contrato

```
AdminContractsPage
  └── handleSend()
        ├── Construye templateFields: { _templateContent, _legalTitle, _dbTemplateId,
        │     _paymentTemplateId, _logoHeader, _logoWatermark, ...varValues }
        ├── Llama createContractFromTemplate() → contracts.service.ts
        │     └── Supabase Edge Function o lógica local que genera el PDF
        └── Navega a la vista del contrato creado
```

## Upload de PDF directo

Ruta: `AdminUploadPdfTab` en `AdminContractsPage.tsx`
Servicio: `createPdfContractTemplate()` en `contractTemplates.service.ts`

**IMPORTANTE — sanitización del nombre de archivo (v0.2.4+):**

```typescript
// Supabase Storage no acepta espacios ni caracteres especiales en el key
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
const storagePath = `${ownerId}/tpl_${Date.now()}_${safeName}`;
```

Sin esto, nombres como `COMRURAL XXI - Contrato.pdf` generan `Invalid key` al subir.
Aplicar en **cualquier** upload a Supabase Storage, no solo plantillas.

## Contratos en la vista de usuario (`ContractsPage`)

Pendiente de reestructura:
- [ ] Tabs: Recibidos / Completados
- [ ] Filtro por tipo
- [ ] Botón de descarga en formato presentable

## Servicios relevantes

| Servicio | Archivo |
|---|---|
| `createContractFromTemplate()` | `contracts.service.ts` |
| `uploadContractPdf()` | `contracts.service.ts` |
| `createPdfContractTemplate()` | `contractTemplates.service.ts` |
| `getContractTemplates()` | `contractTemplates.service.ts` |
