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

function DocSigEmpty({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="border-t-2 border-zinc-300 pt-3 mt-14">
        <p className="text-[11px] text-zinc-400 italic">{label}</p>
        <p className="text-[11px] text-zinc-300">Firma pendiente</p>
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
        <DocSigEmpty label="El/La Alumno/a" />
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
        <DocSigEmpty label="Locatario/a" />
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
        <DocSigEmpty label="Comprador/a" />
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
        <DocSigEmpty label="Comitente" />
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
        <DocSigEmpty label="Comitente" />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

function ConvenioDoc({ f, alumnos }: { f: Record<string, string>; alumnos: AlumnoData[] }) {
  const juris = f.jurisdiccion || "Ciudad Autónoma de Buenos Aires";
  const p1 = alumnos[0] || { nombre: "", dni: "", cuil: "", email: "", domicilio: "" };
  const p2 = alumnos[1] || { nombre: "", dni: "", cuil: "", email: "", domicilio: "" };

  return (
    <DocWrapper>
      <DocTitle
        title="Convenio Privado Bilateral"
        subtitle="Generado a través de Escencial Consultora"
      />
      <DocIntro text={`En la ciudad de ${juris}, República Argentina, a la fecha de la firma electrónica registrada.`} />
      
      <DocParties label="Partes intervinientes" items={[
        <><strong>PARTE A:</strong> <Hi>{p1.nombre || "—"}</Hi>, D.N.I. N° <Hi>{p1.dni || "—"}</Hi>{p1.cuil ? `, CUIL ${p1.cuil}` : ""}{p1.domicilio ? `, domicilio: ${p1.domicilio}` : ""}, correo: <Hi>{p1.email || "—"}</Hi> (en adelante, <em>«LA PARTE A»</em>).</>,
        <><strong>PARTE B:</strong> <Hi>{p2.nombre || "—"}</Hi>, D.N.I. N° <Hi>{p2.dni || "—"}</Hi>{p2.cuil ? `, CUIL ${p2.cuil}` : ""}{p2.domicilio ? `, domicilio: ${p2.domicilio}` : ""}, correo: <Hi>{p2.email || "—"}</Hi> (en adelante, <em>«LA PARTE B»</em>).</>,
      ]} />
      
      <DocClause n="PRIMERA" title="OBJETO DEL CONVENIO">
        <span className="whitespace-pre-wrap">{f.objeto_convenio || "—"}</span>
      </DocClause>
      
      <DocClause n="SEGUNDA" title="CLÁUSULAS ADICIONALES Y CONDICIONES">
        <span className="whitespace-pre-wrap">{f.clausulas_adicionales || "No se establecen cláusulas adicionales."}</span>
      </DocClause>

      <DocClause n="TERCERA" title="CONFORMIDAD Y BUENA FE">
        Ambas partes declaran haber leído y comprendido los términos del presente convenio, obligándose a su cumplimiento de buena fe. El presente acuerdo refleja la entera voluntad de las partes.
      </DocClause>

      <DocClause n="CUARTA" title="VALIDEZ DE LA FIRMA ELECTRÓNICA">
        El presente convenio es firmado electrónicamente con plena validez legal conforme a la Ley N° 25.506. La plataforma de Escencial Consultora actúa únicamente como prestadora del servicio de firma, no asumiendo responsabilidad alguna por las obligaciones contraídas entre las partes.
      </DocClause>

      <DocClause n="QUINTA" title="JURISDICCIÓN">
        Para cualquier controversia derivada del presente, las partes se someten a la jurisdicción de <Hi>{juris}</Hi>.
      </DocClause>

      <DocSignatures>
        <DocSig label="Parte A" name={p1.nombre || "—"} sub={`DNI: ${p1.dni || "—"}`} />
        <DocSig label="Parte B" name={p2.nombre || "—"} sub={`DNI: ${p2.dni || "—"}`} />
      </DocSignatures>
      <DocFooter />
    </DocWrapper>
  );
}

// ─── Main export: router ─────────────────────────────────────────────────────

export function ContractDocument({
  templateId,
  fields,
  alumnos,
}: {
  templateId: string;
  fields: Record<string, string>;
  alumnos: AlumnoData[];
}) {
  const alumno = alumnos[0]; // For legacy templates that expect a single "alumno"

  switch (templateId) {
    case "formacion": return <FormacionDoc f={fields} alumno={alumno} />;
    case "inmueble":  return <InmuebleDoc  f={fields} alumno={alumno} />;
    case "reserva":   return <ReservaDoc   f={fields} alumno={alumno} />;
    case "software":  return <SoftwareDoc  f={fields} alumno={alumno} />;
    case "soporte":   return <SoporteDoc   f={fields} alumno={alumno} />;
    case "convenio_terceros": return <ConvenioDoc f={fields} alumnos={alumnos} />;
    default: return <div className="p-8 text-zinc-400 text-sm text-center">Template no reconocido.</div>;
  }
}

// ─── Contract detail viewer (for existing contracts from the list) ─────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT:                { label: "Enviado",            color: "text-amber-700 bg-amber-50 border-amber-200" },
  VIEWED:              { label: "Visto",              color: "text-blue-700 bg-blue-50 border-blue-200" },
  CONFORMITY_ACCEPTED: { label: "Conformidad aceptada", color: "text-blue-700 bg-blue-50 border-blue-200" },
  SIGNED:              { label: "Firmado",            color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  COMPLETED:           { label: "Completado",         color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  REJECTED:            { label: "Rechazado",          color: "text-red-700 bg-red-50 border-red-200" },
  EXPIRED:             { label: "Vencido",            color: "text-red-700 bg-red-50 border-red-200" },
  DRAFT:               { label: "Borrador",           color: "text-zinc-400 bg-zinc-50 border-zinc-200" },
};

import { createPortal } from "react-dom";

export function ContractDetailModal({
  contract,
  onClose,
}: {
  contract: Contract;
  onClose: () => void;
}) {
  const st = STATUS_LABELS[contract.status] ?? { label: contract.status, color: "text-zinc-400 bg-zinc-50 border-zinc-200" };

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />

      {/* Drawer */}
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/80 px-6 py-5 backdrop-blur-md">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.color}`}>
                {st.label}
              </span>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest">#{contract.id.split("-")[0]}</p>
            </div>
            <h2 className="font-bold text-zinc-900 text-lg leading-tight truncate">{contract.title}</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Main Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 flex items-center gap-2 shadow-sm">
                <span>Versión {contract.versionNumber}</span>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 flex items-center gap-2 shadow-sm">
                <span>{contract.completedSigners} / {contract.totalSigners} firmas</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition hover:bg-zinc-100/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Creado el</p>
              <p className="text-sm font-medium text-zinc-800">{fmtDate(contract.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition hover:bg-zinc-100/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Última actualización</p>
              <p className="text-sm font-medium text-zinc-800">{fmtDate(contract.updatedAt)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition hover:bg-zinc-100/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Propietario</p>
            <p className="text-sm font-medium text-zinc-800">{contract.ownerEmail}</p>
          </div>

          {contract.description && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 transition hover:bg-zinc-100/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Descripción y Destinatarios</p>
              <p className="text-sm text-zinc-600 leading-relaxed">{contract.description}</p>
            </div>
          )}

          {/* SHA-256 Hash */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-bl-full -mr-8 -mt-8 opacity-50 transition group-hover:scale-110" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1.5 relative z-10">Huella Criptográfica (SHA-256)</p>
            <p className="font-mono text-[11px] text-zinc-700 break-all leading-relaxed relative z-10 selection:bg-blue-200">
              {contract.sha256Hash}
            </p>
            <p className="mt-2 text-[10px] text-zinc-500 relative z-10">
              Este identificador único garantiza la inmutabilidad y validez legal del documento.
            </p>
          </div>

          {/* Document Preview Placeholder */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3 ml-1">Contenido Documental</p>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm bg-white">
              <div className="bg-zinc-50 border-b border-zinc-200 p-3 flex justify-between items-center">
                <span className="text-xs font-mono text-zinc-500">{contract.fileName || "documento.pdf"}</span>
              </div>
              <div className="p-8 font-serif text-[12px] leading-6 space-y-4 text-zinc-900 bg-gradient-to-b from-white to-zinc-50/30">
                <div className="text-center pb-5 border-b border-zinc-200">
                  <h1 className="text-sm font-bold uppercase tracking-widest font-sans">{contract.title}</h1>
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">Escencial Consultora S.A.S.</p>
                </div>
                <div className="space-y-2 opacity-80">
                  <div className="h-3 bg-zinc-200 rounded-full w-full" />
                  <div className="h-3 bg-zinc-200 rounded-full w-5/6" />
                  <div className="h-3 bg-zinc-200 rounded-full w-4/6" />
                </div>
                <p className="text-[10px] text-zinc-400 text-center pt-6 border-t border-zinc-100 font-sans italic">
                  Visualización técnica parcial. El documento completo en formato PDF y firmado digitalmente estará disponible tras completar las integraciones necesarias.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}

