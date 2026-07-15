/**
 * Contract template utility — definitions and generators for all legal templates.
 * TODO:SUPABASE — Templates will be stored in DB; this becomes a renderer only.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface AlumnoData {
  nombre: string;
  email: string;
  dni: string;
  cuil: string;
  domicilio: string;
  signatureUrl?: string | null;
}

export interface TemplateFieldDef {
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select";
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  prefix?: string;
  span?: "full";
}

export interface ContractTemplateDef {
  id: string;
  name: string;
  legalTitle: string;
  category: string;
  description: string;
  accent: "blue" | "amber" | "emerald" | "purple" | "rose";
  requiredSigners?: number;
  fields: Record<string, TemplateFieldDef>;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function numberToWords(n: number): string {
  if (!n || n === 0) return "CERO";
  n = Math.floor(n);
  const UNITS = [
    "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE",
    "DIECIOCHO", "DIECINUEVE",
  ];
  const TENS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  if (n < 20) return UNITS[n];
  if (n === 20) return "VEINTE";
  if (n < 30) return "VEINTI" + UNITS[n - 20];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t] : `${TENS[t]} Y ${UNITS[u]}`;
  }
  if (n === 100) return "CIEN";
  if (n < 1000) {
    const h = Math.floor(n / 100), rest = n % 100;
    const hs = h === 1 ? "CIENTO" : HUNDREDS[h];
    return rest === 0 ? hs : `${hs} ${numberToWords(rest)}`;
  }
  const k = Math.floor(n / 1000), rest = n % 1000;
  const ks = k === 1 ? "MIL" : `${numberToWords(k)} MIL`;
  return rest === 0 ? ks : `${ks} ${numberToWords(rest)}`;
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "___/___/______";
  const [y, m, d] = dateStr.split("-");
  const months = ["enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${parseInt(d)} de ${months[parseInt(m) - 1] ?? "?"} de ${y}`;
}

/** Add N months to a date string (YYYY-MM-DD) */
export function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ─── Contract Templates ───────────────────────────────────────────────────────

export const CONTRACT_TEMPLATES: ContractTemplateDef[] = [
  // 1. Formación y Pago
  {
    id: "formacion",
    name: "Formación y Pago",
    legalTitle: "Contrato de Prestación de Servicios de Formación y Convenio de Pago Diferido",
    category: "Educación",
    description: "Para capacitaciones futuras o reconocimiento de deuda por servicio educativo ya comprometido.",
    accent: "blue",
    fields: {
      curso_nombre:       { label: "Nombre del curso / servicio",  type: "text",   placeholder: "Ej: Liquidación de Sueldos 2026" },
      monto_total:        { label: "Monto total ($)",              type: "number", placeholder: "150000", prefix: "$" },
      monto_cuota:        { label: "Monto por cuota ($)",          type: "number", placeholder: "25000",  prefix: "$" },
      cantidad_cuotas:    { label: "Cantidad de cuotas",           type: "number", placeholder: "6" },
      fecha_inicio:       { label: "Venc. primera cuota",          type: "date" },
      fecha_vencimiento:  { label: "Venc. última cuota",           type: "date" },
      jurisdiccion:       { label: "Jurisdicción",                 type: "text",   placeholder: "Ciudad Autónoma de Buenos Aires", defaultValue: "Ciudad Autónoma de Buenos Aires" },
    },
  },

  // 2. Alquiler de Inmueble
  {
    id: "inmueble",
    name: "Alquiler de Inmueble",
    legalTitle: "Contrato de Locación de Inmueble",
    category: "Inmobiliario",
    description: "Locación de vivienda, local comercial u oficina con plazo, ajuste ICL y depósito.",
    accent: "amber",
    fields: {
      locador_nombre:     { label: "Nombre del locador (propietario)", type: "text",   placeholder: "Juan García" },
      locador_dni:        { label: "DNI del locador",                  type: "text",   placeholder: "30123456" },
      domicilio_inmueble: { label: "Domicilio del inmueble",           type: "text",   placeholder: "Av. Corrientes 1234, CABA", span: "full" },
      uso:                { label: "Destino del inmueble",             type: "select", options: ["Vivienda", "Local comercial", "Oficina", "Depósito"], defaultValue: "Vivienda" },
      precio_mensual:     { label: "Alquiler mensual ($)",             type: "number", placeholder: "200000", prefix: "$" },
      duracion_meses:     { label: "Duración (meses)",                 type: "number", placeholder: "24", defaultValue: "24" },
      fecha_inicio:       { label: "Fecha de inicio",                  type: "date" },
      deposito_meses:     { label: "Meses de depósito",                type: "number", placeholder: "1", defaultValue: "1" },
      jurisdiccion:       { label: "Jurisdicción",                     type: "text",   placeholder: "Ciudad Autónoma de Buenos Aires", defaultValue: "Ciudad Autónoma de Buenos Aires" },
    },
  },

  // 3. Seña y Reserva
  {
    id: "reserva",
    name: "Seña y Reserva",
    legalTitle: "Contrato de Seña y Reserva de Compraventa de Bien Mueble",
    category: "Compraventa",
    description: "Reserva de bien mueble con arras confirmatorias según Art. 1059 del C.C.C.N.",
    accent: "emerald",
    fields: {
      bien_descripcion: { label: "Descripción del bien",           type: "textarea", placeholder: "Notebook Dell Inspiron 15 3000, S/N: XYZ123, color negro, con cargador original...", span: "full" },
      vendedor_nombre:  { label: "Nombre del vendedor/a",          type: "text",     placeholder: "María González" },
      vendedor_dni:     { label: "DNI del vendedor/a",             type: "text",     placeholder: "35789012" },
      precio_total:     { label: "Precio total de venta ($)",      type: "number",   placeholder: "500000", prefix: "$" },
      monto_sena:       { label: "Monto de la seña ($)",           type: "number",   placeholder: "100000", prefix: "$" },
      plazo_dias:       { label: "Plazo para saldo (días hábiles)",type: "number",   placeholder: "30" },
      fecha_sena:       { label: "Fecha de la seña",               type: "date" },
      jurisdiccion:     { label: "Jurisdicción",                   type: "text",     placeholder: "Ciudad Autónoma de Buenos Aires", defaultValue: "Ciudad Autónoma de Buenos Aires" },
    },
  },

  // 4. Desarrollo de Software
  {
    id: "software",
    name: "Desarrollo de Software",
    legalTitle: "Contrato de Locación de Obra para Desarrollo de Software y Plataforma Digital",
    category: "Tecnología",
    description: "Desarrollo de plataforma o sistema con especificación de entregables y propiedad intelectual.",
    accent: "purple",
    fields: {
      plataforma_descripcion:  { label: "Descripción del proyecto",          type: "textarea", placeholder: "Plataforma web de gestión de firma electrónica con panel administrador, módulo KYC, flujo de firma electrónica y auditoría...", span: "full" },
      entregables:             { label: "Entregables comprometidos",         type: "textarea", placeholder: "1. Módulo de autenticación y verificación KYC\n2. Panel de administración\n3. Flujo de firma electrónica con OTP\n4. Documentación técnica y manual de usuario", span: "full" },
      precio_total:            { label: "Precio total del proyecto ($)",     type: "number",   placeholder: "800000", prefix: "$" },
      condiciones_pago:        { label: "Condiciones de pago",               type: "text",     placeholder: "50% al inicio · 25% en hito intermedio · 25% a la entrega", span: "full" },
      fecha_inicio:            { label: "Fecha de inicio",                   type: "date" },
      fecha_entrega:           { label: "Fecha de entrega comprometida",     type: "date" },
      plazo_correcciones_dias: { label: "Período de correcciones (días hábiles)", type: "number", placeholder: "15", defaultValue: "15" },
      jurisdiccion:            { label: "Jurisdicción",                      type: "text",     placeholder: "Ciudad Autónoma de Buenos Aires", defaultValue: "Ciudad Autónoma de Buenos Aires" },
    },
  },

  // 5. Soporte y Mantenimiento
  {
    id: "soporte",
    name: "Soporte y Mantenimiento",
    legalTitle: "Contrato de Locación de Servicios de Soporte Técnico, Mantenimiento y Garantía",
    category: "Servicios",
    description: "Servicio post-entrega, mantenimiento técnico y garantía por período determinado con SLA.",
    accent: "rose",
    fields: {
      servicio_descripcion:       { label: "Descripción del servicio",           type: "textarea", placeholder: "Soporte técnico correctivo y preventivo sobre la plataforma digital entregada, incluyendo resolución de incidencias, actualizaciones de seguridad y asistencia técnica a usuarios finales...", span: "full" },
      duracion_dias:              { label: "Duración del servicio (días)",        type: "number",   placeholder: "30", defaultValue: "30" },
      precio_total:               { label: "Precio total del servicio ($)",       type: "number",   placeholder: "150000", prefix: "$" },
      sla_respuesta:              { label: "Tiempo de respuesta comprometido (SLA)", type: "text",  placeholder: "48 horas hábiles", defaultValue: "48 horas hábiles" },
      fecha_inicio:               { label: "Fecha de inicio",                     type: "date" },
      fecha_fin:                  { label: "Fecha de finalización",               type: "date" },
      penalidad_incumplimiento:   { label: "Penalidad por incumplimiento SLA (%)", type: "number", placeholder: "10", defaultValue: "10" },
      jurisdiccion:               { label: "Jurisdicción",                        type: "text",     placeholder: "Ciudad Autónoma de Buenos Aires", defaultValue: "Ciudad Autónoma de Buenos Aires" },
    },
  },

];

// Legacy export kept for backward compat — maps to "formacion" template fields
export const CONTRACT_FIELD_DEFS = CONTRACT_TEMPLATES[0].fields;

// Legacy type kept for backward compat
export type ContractVariables = {
  curso_nombre: string;
  monto_total: string;
  monto_cuota: string;
  cantidad_cuotas: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  jurisdiccion: string;
};
