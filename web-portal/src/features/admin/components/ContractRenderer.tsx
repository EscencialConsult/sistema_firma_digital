/**
 * ContractRenderer — renders the visual legal document for each contract template.
 * Also includes ContractDetailView for viewing existing contracts.
 */

import { X } from "lucide-react";
import type { Contract } from "../../../shared/types/contract";
import { numberToWords, formatDateLong, addMonths } from "../../../shared/utils/contractTemplate";
import type { AlumnoData } from "../../../shared/utils/contractTemplate";

// ─── Common doc wrapper ────────────────────────────────────────────────────────

function DocWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-y-auto max-h-[58vh] rounded-2xl bg-white text-zinc-900 shadow-inner border border-zinc-200">
      <div className="p-8 font-serif text-[13px] leading-7 space-y-4">
        {children}
      </div>
    </div>
  );
}

function DocTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center space-y-1 pb-5 border-b border-zinc-200">
      <h1 className="text-sm font-bold uppercase tracking-widest font-sans leading-snug">{title}</h1>
      {subtitle && <p className="text-[11px] text-zinc-500 font-sans">{subtitle}</p>}
    </div>
  );
}

function DocIntro({ text }: { text: string }) {
  return <p className="text-xs text-zinc-500 italic">{text}</p>;
}

function DocParties({ label, items }: { label: string; items: React.ReactNode[] }) {
  return (
    <div className="space-y-2">
      <p className="font-bold text-xs uppercase tracking-widest text-zinc-600 font-sans">{label}</p>
      {items.map((item, i) => <p key={i}>{item}</p>)}
    </div>
  );
}

function DocClause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <p>
      <strong>{n} — {title}.</strong>{" "}{children}
    </p>
  );
}

function DocSig({ label, name, sub }: { label: string; name: string; sub: string }) {
  return (
    <div className="text-center">
      <div className="border-t-2 border-zinc-500 pt-3 mt-14">
        <p className="font-bold text-xs uppercase font-sans">{name}</p>
        <p className="text-[11px] text-zinc-500">{sub}</p>
        <p className="text-[11px] text-zinc-500 italic">{label}</p>
      </div>
    </div>
  );
}

function DocSignatures({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t-2 border-zinc-200 pt-6 mt-4 grid grid-cols-2 gap-12">
      {children}
    </div>
  );
}

function DocFooter() {
  return (
    <p className="text-center text-[10px] text-zinc-400 border-t border-zinc-100 pt-3 mt-2 font-sans">
      Generado por Sistema Firma Digital · Escencial Consultora S.A.S. · Ley N° 25.506 de Firma Digital
    </p>
  );
}

function Hi({ children }: { children: React.ReactNode }) {
  return <strong className="text-blue-700">{children}</strong>;
}

// ─── Template renderers ───────────────────────────────────────────────────────

function FormacionDoc({ f, alumno }: { f: Record<string, string>; alumno: AlumnoData }) {
  const total  = parseInt(f.monto_total    ?? "0") || 0;
  const cuota  = parseInt(f.monto_cuota    ?? "0") || 0;
  const cuotas = parseInt(f.cantidad_cuotas ?? "0") || 0;
  const juris  = f.jurisdiccion || "Ciudad Autónoma de Buenos Aires";

  return (
    <DocWrapper>
      <DocTitle
        title="Contrato de Prestación de Servicios de Formación y Convenio de Pago Diferido"
        subtitle="Escencial Consultora S.A.S."
      />
      <DocIntro text={`En la ciudad de ${juris}, República Argentina, a la fecha de la firma electrónica registrada.`} />
      <DocParties label="Partes intervinientes" items={[
        <><strong>PRESTADORA:</strong> ESCENCIAL CONSULTORA S.A.S., CUIT 30-71234567-9, con domicilio en Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires (<em>«LA EMPRESA»</em>).</>,
        <><strong>COMITENTE:</strong> <Hi>{alumno.nombre || "—"}</Hi>, D.N.I. N° <Hi>{alumno.dni || "—"}</Hi>, CUIL <Hi>{alumno.cuil || "—"}</Hi>{alumno.domicilio ? `, domicilio: ${alumno.domicilio}` : ""}, correo: <Hi>{alumno.email || "—"}</Hi> (<em>«EL/LA ALUMNO/A»</em>).</>,
      ]} />
      <DocClause n="PRIMERA" title="OBJETO">
        LA EMPRESA prestará el servicio de capacitación denominado <Hi>«{f.curso_nombre || "—"}»</Hi>, cuyo contenido, modalidad y duración han sido acordados entre las partes con anterioridad a la firma.
      </DocClause>
      <DocClause n="SEGUNDA" title="RECONOCIMIENTO DE DEUDA">
        EL/LA ALUMNO/A reconoce adeudar a LA EMPRESA la suma de PESOS <Hi>{numberToWords(total)}</Hi> ($ {total.toLocaleString("es-AR")}), líquida, exigible y de reconocimiento incondicional, en concepto de arancel por el servicio referido.
      </DocClause>
      <DocClause n="TERCERA" title="PLAN DE PAGOS">
        El monto reconocido será abonado en <Hi>{cuotas} ({numberToWords(cuotas)})</Hi> cuotas mensuales, iguales y consecutivas de PESOS <Hi>{numberToWords(cuota)}</Hi> ($ {cuota.toLocaleString("es-AR")}) cada una. Primera cuota: <Hi>{formatDateLong(f.fecha_inicio ?? "")}</Hi>. Última cuota: <Hi>{formatDateLong(f.fecha_vencimiento ?? "")}</Hi>.
      </DocClause>
      <DocClause n="CUARTA" title="MORA AUTOMÁTICA">
        La falta de pago en término produce mora automática de pleno derecho, sin intimación previa, devengando interés punitorio del TRES POR CIENTO (3%) mensual sobre el saldo impago, más los gastos y honorarios de cobranza que resulten necesarios.
      </DocClause>
      <DocClause n="QUINTA" title="CADUCIDAD DE PLAZOS">
        El incumplimiento de dos (2) cuotas consecutivas o tres (3) alternadas habilita a LA EMPRESA a declarar vencidos todos los plazos, tornando exigible la totalidad del saldo de manera inmediata.
      </DocClause>
      <DocClause n="SEXTA" title="VALIDEZ DE LA FIRMA ELECTRÓNICA">
        El presente contrato es firmado electrónicamente con plena validez legal conforme a la Ley N° 25.506 de Firma Digital. La firma se ejecuta previo proceso KYC y autenticación OTP, quedando registrado el hash SHA-256 del documento, la IP del firmante, y la fecha, hora y dispositivo de firma.
      </DocClause>
      <DocClause n="SÉPTIMA" title="JURISDICCIÓN">
        Las partes se someten a los Tribunales Ordinarios de <Hi>{juris}</Hi>, renunciando expresamente a cualquier otro fuero.
      </DocClause>
      <DocClause n="OCTAVA" title="DIVISIBILIDAD">
        La nulidad de cualquier cláusula no afecta la validez de las restantes.
      </DocClause>
      <DocSignatures>
        <DocSig label="Representante Legal" name="Escencial Consultora S.A.S." sub="CUIT 30-71234567-9" />
        <DocSig label="El/La Alumno/a" name={alumno.nombre || "—"} sub={`DNI: ${alumno.dni || "—"}`} />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

function InmuebleDoc({ f, alumno }: { f: Record<string, string>; alumno: AlumnoData }) {
  const precio   = parseInt(f.precio_mensual ?? "0") || 0;
  const meses    = parseInt(f.duracion_meses ?? "24") || 24;
  const deposito = parseInt(f.deposito_meses ?? "1") || 1;
  const juris    = f.jurisdiccion || "Ciudad Autónoma de Buenos Aires";
  const fechaFin = addMonths(f.fecha_inicio ?? "", meses);
  const esComercial = (f.uso ?? "Vivienda") !== "Vivienda";

  return (
    <DocWrapper>
      <DocTitle
        title={esComercial ? "Contrato de Locación de Inmueble Comercial" : "Contrato de Locación de Inmueble"}
        subtitle="Escencial Consultora S.A.S."
      />
      <DocIntro text={`En la ciudad de ${juris}, República Argentina, a la fecha de la firma electrónica registrada.`} />
      <DocParties label="Partes intervinientes" items={[
        <><strong>LOCADOR/A (PROPIETARIO/A):</strong> <Hi>{f.locador_nombre || "—"}</Hi>, D.N.I. N° <Hi>{f.locador_dni || "—"}</Hi> (<em>«EL/LA PROPIETARIO/A»</em>).</>,
        <><strong>LOCATARIO/A:</strong> <Hi>{alumno.nombre || "—"}</Hi>, D.N.I. N° <Hi>{alumno.dni || "—"}</Hi>, CUIL <Hi>{alumno.cuil || "—"}</Hi>{alumno.domicilio ? `, domicilio real: ${alumno.domicilio}` : ""}, correo: <Hi>{alumno.email || "—"}</Hi> (<em>«EL/LA LOCATARIO/A»</em>).</>,
      ]} />
      <DocClause n="PRIMERA" title="OBJETO">
        EL/LA PROPIETARIO/A da en locación al/a la LOCATARIO/A el inmueble ubicado en <Hi>{f.domicilio_inmueble || "—"}</Hi>, destinado exclusivamente para <Hi>{f.uso || "Vivienda"}</Hi>.
      </DocClause>
      <DocClause n="SEGUNDA" title="PLAZO">
        La locación tendrá duración de <Hi>{meses} ({numberToWords(meses)}) meses</Hi>, contados a partir del <Hi>{formatDateLong(f.fecha_inicio ?? "")}</Hi>, finalizando el <Hi>{formatDateLong(fechaFin)}</Hi>, en cumplimiento del plazo mínimo legal establecido por la Ley N° 27.551.
      </DocClause>
      <DocClause n="TERCERA" title="PRECIO Y AJUSTE">
        El canon locativo mensual inicial es de PESOS <Hi>{numberToWords(precio)}</Hi> ($ {precio.toLocaleString("es-AR")}). La actualización del precio se realizará conforme al Índice para Contratos de Locación (ICL) publicado por el Banco Central de la República Argentina, con periodicidad cuatrimestral, en cumplimiento de la Ley N° 27.551.
      </DocClause>
      <DocClause n="CUARTA" title="DEPÓSITO EN GARANTÍA">
        Al inicio de la locación, EL/LA LOCATARIO/A abonará en concepto de depósito en garantía el equivalente a <Hi>{deposito} ({numberToWords(deposito)}) mes(es)</Hi> de alquiler. Dicho importe le será devuelto al finalizar el contrato, previa verificación del estado del inmueble conforme al acta de entrega.
      </DocClause>
      <DocClause n="QUINTA" title="SERVICIOS Y EXPENSAS">
        Todos los servicios públicos (electricidad, gas natural, agua corriente, internet) y las expensas ordinarias correrán por cuenta exclusiva de EL/LA LOCATARIO/A desde la fecha de inicio pactada.
      </DocClause>
      <DocClause n="SEXTA" title="CONSERVACIÓN Y USO">
        EL/LA LOCATARIO/A se obliga a conservar el inmueble en buen estado de mantenimiento y limpieza, respetar el destino pactado y no realizar modificaciones, mejoras ni refacciones sin consentimiento escrito de EL/LA PROPIETARIO/A.
      </DocClause>
      <DocClause n="SÉPTIMA" title="PROHIBICIONES">
        Se prohíbe expresamente la sublocación total o parcial, la cesión del contrato y el cambio de destino sin autorización escrita de EL/LA PROPIETARIO/A.
      </DocClause>
      <DocClause n="OCTAVA" title="VALIDEZ DE LA FIRMA ELECTRÓNICA">
        El presente es firmado electrónicamente con plena validez legal conforme a la Ley N° 25.506 de Firma Digital, previo proceso de verificación de identidad (KYC) y autenticación OTP.
      </DocClause>
      <DocClause n="NOVENA" title="JURISDICCIÓN">
        Las partes se someten a los Tribunales Ordinarios de <Hi>{juris}</Hi>, renunciando a cualquier otro fuero o jurisdicción que pudiera corresponderles.
      </DocClause>
      <DocSignatures>
        <DocSig label="Propietario/a" name={f.locador_nombre || "—"} sub={`DNI: ${f.locador_dni || "—"}`} />
        <DocSig label="Locatario/a" name={alumno.nombre || "—"} sub={`DNI: ${alumno.dni || "—"}`} />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

function ReservaDoc({ f, alumno }: { f: Record<string, string>; alumno: AlumnoData }) {
  const total = parseInt(f.precio_total ?? "0") || 0;
  const sena  = parseInt(f.monto_sena  ?? "0") || 0;
  const saldo = total - sena;
  const juris = f.jurisdiccion || "Ciudad Autónoma de Buenos Aires";

  return (
    <DocWrapper>
      <DocTitle
        title="Contrato de Seña y Reserva de Compraventa de Bien Mueble"
        subtitle="Escencial Consultora S.A.S."
      />
      <DocIntro text={`En la ciudad de ${juris}, República Argentina, con fecha ${formatDateLong(f.fecha_sena ?? "")}.`} />
      <DocParties label="Partes intervinientes" items={[
        <><strong>VENDEDOR/A:</strong> <Hi>{f.vendedor_nombre || "—"}</Hi>, D.N.I. N° <Hi>{f.vendedor_dni || "—"}</Hi> (<em>«EL/LA VENDEDOR/A»</em>).</>,
        <><strong>COMPRADOR/A:</strong> <Hi>{alumno.nombre || "—"}</Hi>, D.N.I. N° <Hi>{alumno.dni || "—"}</Hi>, CUIL <Hi>{alumno.cuil || "—"}</Hi>, correo: <Hi>{alumno.email || "—"}</Hi> (<em>«EL/LA COMPRADOR/A»</em>).</>,
      ]} />
      <DocClause n="PRIMERA" title="OBJETO Y SEÑA">
        EL/LA COMPRADOR/A entrega a EL/LA VENDEDOR/A, en concepto de <strong>SEÑA CONFIRMATORIA</strong> en los términos del Art. 1059 del Código Civil y Comercial de la Nación (Ley N° 26.994), la suma de PESOS <Hi>{numberToWords(sena)}</Hi> ($ {sena.toLocaleString("es-AR")}), en reserva del siguiente bien:
      </DocClause>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[12px]">
        <p className="font-bold font-sans text-xs uppercase tracking-wide text-zinc-600 mb-1">Descripción del bien reservado</p>
        <p className="whitespace-pre-wrap">{f.bien_descripcion || "—"}</p>
      </div>
      <DocClause n="SEGUNDA" title="PRECIO TOTAL">
        El precio total de la compraventa es de PESOS <Hi>{numberToWords(total)}</Hi> ($ {total.toLocaleString("es-AR")}).
      </DocClause>
      <DocClause n="TERCERA" title="SALDO Y PLAZO DE PAGO">
        El saldo de PESOS <Hi>{numberToWords(saldo)}</Hi> ($ {saldo.toLocaleString("es-AR")}) deberá ser abonado por EL/LA COMPRADOR/A dentro de los <Hi>{f.plazo_dias || "—"} días hábiles</Hi> contados a partir de la fecha de la seña. Ante el incumplimiento, se aplicarán los efectos de la seña confirmatoria conforme a la Cláusula Cuarta.
      </DocClause>
      <DocClause n="CUARTA" title="EFECTOS DE LA SEÑA CONFIRMATORIA">
        En los términos del Art. 1059 del C.C.C.N.: (a) Si EL/LA COMPRADOR/A desistiere, perderá la seña entregada en favor de EL/LA VENDEDOR/A, sin perjuicio de la acción de daños y perjuicios que pudiere corresponder. (b) Si EL/LA VENDEDOR/A desistiere, deberá devolver a EL/LA COMPRADOR/A la seña recibida con más una suma igual en concepto de indemnización.
      </DocClause>
      <DocClause n="QUINTA" title="ENTREGA DEL BIEN">
        Abonado el saldo total, EL/LA VENDEDOR/A se obliga a la entrega inmediata del bien en las condiciones acordadas, libre de todo gravamen, prenda o restricción.
      </DocClause>
      <DocClause n="SEXTA" title="GARANTÍA DE ESTADO">
        EL/LA VENDEDOR/A garantiza que el bien se encuentra en buen estado de funcionamiento, es de su exclusiva propiedad y no registra ningún gravamen o inhibición. Ante vicios ocultos, responderá conforme al Art. 1051 del C.C.C.N.
      </DocClause>
      <DocClause n="SÉPTIMA" title="VALIDEZ DE LA FIRMA ELECTRÓNICA">
        El presente es firmado electrónicamente con plena validez legal conforme a la Ley N° 25.506, previo proceso KYC y autenticación OTP.
      </DocClause>
      <DocClause n="OCTAVA" title="JURISDICCIÓN">
        Las partes se someten a los Tribunales Ordinarios de <Hi>{juris}</Hi>, con renuncia expresa a cualquier otro fuero.
      </DocClause>
      <DocSignatures>
        <DocSig label="Vendedor/a" name={f.vendedor_nombre || "—"} sub={`DNI: ${f.vendedor_dni || "—"}`} />
        <DocSig label="Comprador/a" name={alumno.nombre || "—"} sub={`DNI: ${alumno.dni || "—"}`} />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

function SoftwareDoc({ f, alumno }: { f: Record<string, string>; alumno: AlumnoData }) {
  const precio = parseInt(f.precio_total ?? "0") || 0;
  const juris  = f.jurisdiccion || "Ciudad Autónoma de Buenos Aires";

  return (
    <DocWrapper>
      <DocTitle
        title="Contrato de Locación de Obra para Desarrollo de Software y Plataforma Digital"
        subtitle="Escencial Consultora S.A.S."
      />
      <DocIntro text={`En la ciudad de ${juris}, República Argentina, con fecha de inicio ${formatDateLong(f.fecha_inicio ?? "")}.`} />
      <DocParties label="Partes intervinientes" items={[
        <><strong>COMITENTE:</strong> <Hi>{alumno.nombre || "—"}</Hi>, D.N.I. N° <Hi>{alumno.dni || "—"}</Hi>, CUIL <Hi>{alumno.cuil || "—"}</Hi>, correo: <Hi>{alumno.email || "—"}</Hi> (<em>«EL/LA COMITENTE»</em>).</>,
        <><strong>CONTRATISTA:</strong> ESCENCIAL CONSULTORA S.A.S., CUIT 30-71234567-9, representada por su directora. (<em>«LA CONTRATISTA»</em>).</>,
      ]} />
      <DocClause n="PRIMERA" title="OBJETO">
        LA CONTRATISTA se obliga a realizar, bajo su dirección técnica y por el precio acordado, la siguiente obra intelectual:
      </DocClause>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[12px]">
        <p className="font-bold font-sans text-xs uppercase tracking-wide text-zinc-600 mb-1">Descripción del proyecto</p>
        <p className="whitespace-pre-wrap">{f.plataforma_descripcion || "—"}</p>
      </div>
      <DocClause n="SEGUNDA" title="ENTREGABLES COMPROMETIDOS">
        Los siguientes entregables integran el objeto de la presente locación de obra:
      </DocClause>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[12px]">
        <p className="whitespace-pre-wrap">{f.entregables || "—"}</p>
      </div>
      <DocClause n="TERCERA" title="PRECIO Y FORMA DE PAGO">
        El precio total de la obra es de PESOS <Hi>{numberToWords(precio)}</Hi> ($ {precio.toLocaleString("es-AR")}). Condiciones de pago: <Hi>{f.condiciones_pago || "—"}</Hi>.
      </DocClause>
      <DocClause n="CUARTA" title="PLAZOS">
        La obra se iniciará el <Hi>{formatDateLong(f.fecha_inicio ?? "")}</Hi> y deberá ser entregada a más tardar el <Hi>{formatDateLong(f.fecha_entrega ?? "")}</Hi>, salvo circunstancias de fuerza mayor debidamente acreditadas.
      </DocClause>
      <DocClause n="QUINTA" title="PERÍODO DE CORRECCIONES">
        A partir de la entrega, EL/LA COMITENTE dispondrá de <Hi>{f.plazo_correcciones_dias || "15"} días hábiles</Hi> para solicitar correcciones menores vinculadas estrictamente al objeto pactado. Las modificaciones de alcance serán presupuestadas por separado.
      </DocClause>
      <DocClause n="SEXTA" title="PROPIEDAD INTELECTUAL">
        Abonado el precio íntegro, todos los derechos patrimoniales sobre el software y plataforma desarrollados serán cedidos en forma exclusiva e irrevocable a EL/LA COMITENTE, conforme a la Ley N° 11.723 de Propiedad Intelectual de la República Argentina. LA CONTRATISTA conserva el derecho moral de autoría.
      </DocClause>
      <DocClause n="SÉPTIMA" title="CONFIDENCIALIDAD">
        Ambas partes se obligan a mantener estricta confidencialidad sobre la información técnica, funcional, comercial y de negocios intercambiada durante la ejecución del presente, por un plazo de cinco (5) años desde la finalización del contrato.
      </DocClause>
      <DocClause n="OCTAVA" title="VALIDEZ DE LA FIRMA ELECTRÓNICA">
        El presente es firmado electrónicamente con plena validez legal conforme a la Ley N° 25.506.
      </DocClause>
      <DocClause n="NOVENA" title="JURISDICCIÓN">
        Las partes se someten a los Tribunales de <Hi>{juris}</Hi>, renunciando a cualquier otro fuero.
      </DocClause>
      <DocSignatures>
        <DocSig label="Contratista" name="Escencial Consultora S.A.S." sub="CUIT 30-71234567-9" />
        <DocSig label="Comitente" name={alumno.nombre || "—"} sub={`DNI: ${alumno.dni || "—"}`} />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

function SoporteDoc({ f, alumno }: { f: Record<string, string>; alumno: AlumnoData }) {
  const precio      = parseInt(f.precio_total   ?? "0") || 0;
  const penalidad   = parseInt(f.penalidad_incumplimiento ?? "10") || 10;
  const juris       = f.jurisdiccion || "Ciudad Autónoma de Buenos Aires";

  return (
    <DocWrapper>
      <DocTitle
        title="Contrato de Locación de Servicios de Soporte Técnico, Mantenimiento y Garantía"
        subtitle="Escencial Consultora S.A.S."
      />
      <DocIntro text={`En la ciudad de ${juris}, República Argentina, con fecha de inicio ${formatDateLong(f.fecha_inicio ?? "")}.`} />
      <DocParties label="Partes intervinientes" items={[
        <><strong>COMITENTE:</strong> <Hi>{alumno.nombre || "—"}</Hi>, D.N.I. N° <Hi>{alumno.dni || "—"}</Hi>, CUIL <Hi>{alumno.cuil || "—"}</Hi>, correo: <Hi>{alumno.email || "—"}</Hi> (<em>«EL/LA COMITENTE»</em>).</>,
        <><strong>PRESTADORA:</strong> ESCENCIAL CONSULTORA S.A.S., CUIT 30-71234567-9 (<em>«LA PRESTADORA»</em>).</>,
      ]} />
      <DocClause n="PRIMERA" title="OBJETO">
        LA PRESTADORA se obliga a prestar los siguientes servicios técnicos durante el período pactado:
      </DocClause>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[12px]">
        <p className="whitespace-pre-wrap">{f.servicio_descripcion || "—"}</p>
      </div>
      <DocClause n="SEGUNDA" title="PLAZO">
        La prestación tendrá una duración de <Hi>{f.duracion_dias || "30"} días corridos</Hi>, contados desde el <Hi>{formatDateLong(f.fecha_inicio ?? "")}</Hi> hasta el <Hi>{formatDateLong(f.fecha_fin ?? "")}</Hi> inclusive.
      </DocClause>
      <DocClause n="TERCERA" title="PRECIO">
        El precio total del servicio es de PESOS <Hi>{numberToWords(precio)}</Hi> ($ {precio.toLocaleString("es-AR")}), abonadero según las condiciones acordadas entre las partes.
      </DocClause>
      <DocClause n="CUARTA" title="NIVEL DE SERVICIO (SLA)">
        LA PRESTADORA se compromete a responder toda solicitud de soporte en un plazo máximo de <Hi>{f.sla_respuesta || "48 horas hábiles"}</Hi> a partir de la notificación fehaciente por parte de EL/LA COMITENTE. Las solicitudes críticas serán atendidas con prioridad máxima.
      </DocClause>
      <DocClause n="QUINTA" title="PENALIDAD POR INCUMPLIMIENTO DEL SLA">
        El incumplimiento del plazo de respuesta pactado generará a favor de EL/LA COMITENTE una penalidad del <Hi>{penalidad}% (${numberToWords(penalidad)} POR CIENTO)</Hi> sobre el valor mensual proporcional del servicio, por cada incidente no atendido en plazo debidamente documentado.
      </DocClause>
      <DocClause n="SEXTA" title="EXCLUSIONES">
        El presente servicio no comprende: desarrollo de nuevas funcionalidades no especificadas en el objeto original, cambios de alcance del sistema preexistente, ni fallas derivadas del uso indebido por parte de EL/LA COMITENTE o terceros no autorizados.
      </DocClause>
      <DocClause n="SÉPTIMA" title="ACCESO AL SISTEMA">
        EL/LA COMITENTE otorgará a LA PRESTADORA los accesos técnicos necesarios (entornos, credenciales, repositorios) para la correcta prestación del servicio, bajo estrictas condiciones de confidencialidad.
      </DocClause>
      <DocClause n="OCTAVA" title="VALIDEZ DE LA FIRMA ELECTRÓNICA">
        El presente contrato es firmado electrónicamente con plena validez legal conforme a la Ley N° 25.506.
      </DocClause>
      <DocClause n="NOVENA" title="JURISDICCIÓN">
        Las partes se someten a los Tribunales de <Hi>{juris}</Hi>, renunciando a cualquier otro fuero.
      </DocClause>
      <DocSignatures>
        <DocSig label="Prestadora" name="Escencial Consultora S.A.S." sub="CUIT 30-71234567-9" />
        <DocSig label="Comitente" name={alumno.nombre || "—"} sub={`DNI: ${alumno.dni || "—"}`} />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

// ─── Main export: router ─────────────────────────────────────────────────────

export function ContractDocument({
  templateId,
  fields,
  alumno,
}: {
  templateId: string;
  fields: Record<string, string>;
  alumno: AlumnoData;
}) {
  switch (templateId) {
    case "formacion": return <FormacionDoc f={fields} alumno={alumno} />;
    case "inmueble":  return <InmuebleDoc  f={fields} alumno={alumno} />;
    case "reserva":   return <ReservaDoc   f={fields} alumno={alumno} />;
    case "software":  return <SoftwareDoc  f={fields} alumno={alumno} />;
    case "soporte":   return <SoporteDoc   f={fields} alumno={alumno} />;
    default: return <div className="p-8 text-zinc-400 text-sm text-center">Template no reconocido.</div>;
  }
}

// ─── Contract detail viewer (for existing contracts from the list) ─────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT:                { label: "Enviado",            color: "text-amber-400 bg-amber-900/30 border-amber-800" },
  VIEWED:              { label: "Visto",              color: "text-blue-400 bg-blue-900/20 border-blue-800" },
  CONFORMITY_ACCEPTED: { label: "Conformidad aceptada", color: "text-blue-400 bg-blue-900/20 border-blue-800" },
  SIGNED:              { label: "Firmado",            color: "text-emerald-400 bg-emerald-900/30 border-emerald-800" },
  COMPLETED:           { label: "Completado",         color: "text-emerald-400 bg-emerald-900/30 border-emerald-800" },
  REJECTED:            { label: "Rechazado",          color: "text-red-400 bg-red-900/20 border-red-800" },
  EXPIRED:             { label: "Vencido",            color: "text-red-400 bg-red-900/20 border-red-800" },
  DRAFT:               { label: "Borrador",           color: "text-zinc-400 bg-zinc-800 border-zinc-700" },
};

export function ContractDetailModal({
  contract,
  onClose,
}: {
  contract: Contract;
  onClose: () => void;
}) {
  const st = STATUS_LABELS[contract.status] ?? { label: contract.status, color: "text-zinc-400 bg-zinc-800 border-zinc-700" };

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
          <div className="min-w-0 pr-4">
            <p className="text-xs text-zinc-600 font-mono mb-0.5">Contrato #{contract.id}</p>
            <h2 className="font-bold text-white leading-snug">{contract.title}</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Status + version */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${st.color}`}>
              {st.label}
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
              Versión {contract.versionNumber}
            </span>
            <span className="text-xs text-zinc-600">
              {contract.completedSigners}/{contract.totalSigners} firmas completadas
            </span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-600 mb-0.5">Creado</p>
              <p className="text-sm font-medium text-zinc-300">{fmtDate(contract.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-600 mb-0.5">Última actualización</p>
              <p className="text-sm font-medium text-zinc-300">{fmtDate(contract.updatedAt)}</p>
            </div>
          </div>

          {/* Owner */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-600 mb-1">Creado por</p>
            <p className="text-sm font-medium text-zinc-300">{contract.ownerEmail}</p>
          </div>

          {/* Description */}
          {contract.description && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-600 mb-1">Descripción</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{contract.description}</p>
            </div>
          )}

          {/* Document hash */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-600 mb-2">Huella digital del documento (SHA-256)</p>
            <p className="font-mono text-[11px] text-emerald-500 break-all leading-relaxed">
              {contract.sha256Hash}
            </p>
            <p className="mt-2 text-[10px] text-zinc-600">
              Este hash es la prueba criptográfica de integridad del documento. Cualquier modificación posterior al contenido generaría un hash diferente.
            </p>
          </div>

          {/* File */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-600 mb-1">Archivo del contrato</p>
            <p className="text-sm font-mono text-zinc-400">{contract.fileName}</p>
            <p className="mt-2 text-[10px] text-zinc-600">
              El PDF firmado estará disponible en Supabase Storage una vez completada la integración.
            </p>
          </div>

          {/* Document visual (generic) */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-3">Vista del documento</p>
            <div className="overflow-y-auto max-h-72 rounded-2xl bg-white border border-zinc-200 shadow-inner">
              <div className="p-8 font-serif text-[12px] leading-6 space-y-3 text-zinc-900">
                <div className="text-center pb-4 border-b border-zinc-200">
                  <h1 className="text-sm font-bold uppercase tracking-widest font-sans">{contract.title}</h1>
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">Escencial Consultora S.A.S. · Firma Digital</p>
                </div>
                <p className="text-xs text-zinc-500 italic">
                  Documento generado el {fmtDate(contract.createdAt)}.
                </p>
                <p>
                  <strong>{contract.description}</strong>
                </p>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 font-sans text-xs space-y-1">
                  <p className="font-semibold text-zinc-700">Datos técnicos del documento</p>
                  <p><span className="text-zinc-500">Estado:</span> <strong>{st.label}</strong></p>
                  <p><span className="text-zinc-500">Firmantes:</span> <strong>{contract.completedSigners} de {contract.totalSigners}</strong></p>
                  <p><span className="text-zinc-500">Versión:</span> v{contract.versionNumber}</p>
                  <p><span className="text-zinc-500">SHA-256:</span> <span className="font-mono text-emerald-700 text-[10px]">{contract.sha256Hash.slice(0, 24)}...</span></p>
                </div>
                <p className="text-[10px] text-zinc-400 text-center pt-2 border-t border-zinc-100 font-sans">
                  El contenido legal completo está disponible en el PDF del sistema de almacenamiento.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
