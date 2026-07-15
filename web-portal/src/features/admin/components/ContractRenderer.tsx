/**
 * ContractRenderer — renders the visual legal document for each contract template.
 * Also includes ContractDetailView for viewing existing contracts.
 */

import { Calendar, Check, Clock, FileText, Hash, Mail, Plus, Shield, Trash2, User, UserPlus, X } from "lucide-react";
import { loadOrgCache } from "../../../shared/config/orgCache";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Contract, ContractDetail } from "../../../shared/types/contract";
import {
  addContractSigner,
  getContractById,
  removeContractSigner,
} from "../../../shared/services/contracts.service";
import { numberToWords, formatDateLong, addMonths } from "../../../shared/utils/contractTemplate";
import type { AlumnoData } from "../../../shared/utils/contractTemplate";

// ─── Common doc wrapper ────────────────────────────────────────────────────────

function DocWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="contract-doc-wrapper overflow-y-auto max-h-[58vh] rounded-2xl bg-white text-zinc-900 shadow-inner border border-zinc-200">
      <div className="relative p-8 font-serif text-[13px] leading-7 space-y-4">
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

function DocSig({ label, name, sub, signatureUrl }: { label: string; name: string; sub: string; signatureUrl?: string }) {
  return (
    <div className="text-center">
      <div className="relative mt-14">
        {signatureUrl && (
          <img
            src={signatureUrl}
            alt="Firma"
            className="mx-auto mb-1 h-12 object-contain"
            style={{ maxWidth: 160 }}
          />
        )}
        <div className="border-t-2 border-zinc-500 pt-3">
          <p className="font-bold text-xs uppercase font-sans">{name}</p>
          <p className="text-[11px] text-zinc-500">{sub}</p>
          <p className="text-[11px] text-zinc-500 italic">{label}</p>
        </div>
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
      Generado por Sistema Firma Electrónica · Escencial Consultora S.A.S. · Ley N° 25.506 de Firma Digital
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
        <DocSig
          label="Representante Legal — Escencial Consultora S.A.S."
          name={f.autoridad_nombre || "—"}
          sub={f.autoridad_cuil ? `CUIL: ${f.autoridad_cuil}` : ""}
          signatureUrl={f.autoridad_signature_url || undefined}
        />
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
        <DocSig
          label="Contratista — Escencial Consultora S.A.S."
          name={f.autoridad_nombre || "—"}
          sub={f.autoridad_cuil ? `CUIL: ${f.autoridad_cuil}` : ""}
          signatureUrl={f.autoridad_signature_url || undefined}
        />
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
        <DocSig
          label="Prestadora — Escencial Consultora S.A.S."
          name={f.autoridad_nombre || "—"}
          sub={f.autoridad_cuil ? `CUIL: ${f.autoridad_cuil}` : ""}
          signatureUrl={f.autoridad_signature_url || undefined}
        />
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

// ─── Custom Template Renderer ─────────────────────────────────────────────────

function CustomDoc({ f, alumno, logoHeader, logoWatermark, logoUrl }: {
  f: Record<string, string>;
  alumno: AlumnoData;
  logoHeader?: boolean;
  logoWatermark?: boolean;
  logoUrl?: string | null;
}) {
  let content = f._templateContent || "Sin contenido.";
  Object.keys(f).forEach(key => {
    if (key !== "_templateContent" && key !== "_legalTitle") {
      const regex = new RegExp(`{{${key}}}`, "g");
      content = content.replace(regex, f[key] ? `<strong class="text-blue-700">${f[key]}</strong>` : `{{${key}}}`);
    }
  });

  return (
    <DocWrapper>
      {/* Encabezado con logo */}
      {logoHeader && logoUrl && (
        <div className="flex justify-start pb-4 border-b border-zinc-100 mb-2">
          <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
        </div>
      )}
      {/* Marca de agua */}
      {logoWatermark && logoUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
          <img src={logoUrl} alt="" className="w-2/3 object-contain opacity-[0.07]" />
        </div>
      )}
      <div className="relative z-10">
        <DocTitle title={f._legalTitle || "Contrato"} subtitle="Escencial Consultora S.A.S." />
        <div
          className="whitespace-pre-wrap font-serif text-[13px] leading-7"
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <DocSignatures>
          <DocSig label="Firma Autorizada" name={f.autoridad_nombre || "—"} sub={`CUIL/CUIT: ${f.autoridad_cuil || "—"}`} signatureUrl={f.autoridad_signature_url || undefined} />
          <DocSigEmpty label={alumno.nombre || "Firmante"} />
        </DocSignatures>
        <DocFooter />
      </div>
    </DocWrapper>
  );
}

// ─── Main export: router ─────────────────────────────────────────────────────

export function ContractDocument({
  templateId,
  fields,
  alumnos,
  logoHeader,
  logoWatermark,
}: {
  templateId: string;
  fields: Record<string, string>;
  alumnos: AlumnoData[];
  logoHeader?: boolean;
  logoWatermark?: boolean;
}) {
  const alumno = alumnos[0] ?? { nombre: "", dni: "", cuil: "", email: "", domicilio: "" };
  const logoUrl = loadOrgCache()?.logoLightUrl ?? loadOrgCache()?.logoDarkUrl ?? null;

  // If we have a custom template content saved in fields, render CustomDoc
  if (fields._templateContent) {
    return <CustomDoc f={fields} alumno={alumno} logoHeader={logoHeader} logoWatermark={logoWatermark} logoUrl={logoUrl} />;
  }

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

export function ContractDetailModal({
  contract,
  onClose,
  onUpdated,
}: {
  contract: Contract;
  onClose: () => void;
  onUpdated?: (contract: Contract) => void;
}) {
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [savingSigner, setSavingSigner] = useState(false);
  const [signerError, setSignerError] = useState("");
  const [addingSignerOpen, setAddingSignerOpen] = useState(false);
  const displayContract = detail ?? contract;
  const st = STATUS_LABELS[displayContract.status] ?? { label: displayContract.status, color: "text-zinc-400 bg-zinc-50 border-zinc-200" };

  async function reloadDetail() {
    const fresh = await getContractById(contract.id);
    if (!fresh) return;
    setDetail(fresh);
    onUpdated?.(fresh);
  }

  useEffect(() => {
    void reloadDetail();
  }, [contract.id]);

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function handleAddSigner() {
    if (!signerName.trim() || !signerEmail.trim()) return;
    setSavingSigner(true);
    setSignerError("");
    try {
      await addContractSigner(contract.id, {
        name: signerName.trim(),
        email: signerEmail.trim(),
      });
      setSignerName("");
      setSignerEmail("");
      await reloadDetail();
    } catch (err) {
      setSignerError(err instanceof Error ? err.message : "Error agregando firmante");
    } finally {
      setSavingSigner(false);
    }
  }

  async function handleRemoveSigner(signatureRequestId: string) {
    if (!window.confirm("¿Quitar este firmante del contrato?")) return;
    setSignerError("");
    try {
      await removeContractSigner(signatureRequestId);
      await reloadDetail();
    } catch (err) {
      setSignerError(err instanceof Error ? err.message : "Error quitando firmante");
    }
  }

  const signersDone = displayContract.completedSigners;
  const signersTotal = displayContract.totalSigners;
  const allSigned = signersDone > 0 && signersDone === signersTotal;
  const pdfUrl = displayContract.finalPdfUrl || (displayContract as ContractDetail).pdfUrl;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center overflow-hidden p-0 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative flex h-[min(96vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-t-[24px] sm:rounded-[24px] bg-white shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">

        {/* Header con gradiente sutil */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 sm:px-7 border-b border-zinc-100">
          <div className="flex items-start gap-3 min-w-0">
            {/* Ícono de documento */}
            <div className="mt-0.5 shrink-0 h-10 w-10 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <FileText size={18} className="text-zinc-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.color}`}>
                  {st.label}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">#{displayContract.id.split("-")[0]}</span>
                <span className="text-[10px] text-zinc-400">v{displayContract.versionNumber}</span>
              </div>
              <h2 className="font-bold text-zinc-900 text-base leading-tight">{displayContract.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="mt-1 shrink-0 grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: 2 columnas */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] overflow-hidden">

          {/* ── Panel izquierdo ── */}
          <div className="flex flex-col gap-4 overflow-y-auto border-r border-zinc-100 p-5 sm:p-6 bg-zinc-50/50">

            {/* Progreso de firmas */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Progreso de firmas</p>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${allSigned ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
                  {signersDone}/{signersTotal}
                </span>
              </div>
              {/* Barra de progreso */}
              <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: signersTotal > 0 ? `${(signersDone / signersTotal) * 100}%` : "0%",
                    background: allSigned ? "#10b981" : "var(--brand-primary, #18181b)",
                  }}
                />
              </div>
            </div>

            {/* Metadatos */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <div className="divide-y divide-zinc-100">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Calendar size={14} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Creado</p>
                    <p className="text-sm font-medium text-zinc-800 truncate">{fmtDate(displayContract.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock size={14} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Actualizado</p>
                    <p className="text-sm font-medium text-zinc-800 truncate">{fmtDate(displayContract.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail size={14} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Propietario</p>
                    <p className="text-sm font-medium text-zinc-800 truncate">{displayContract.ownerEmail}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Descripción */}
            {displayContract.description && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Descripción</p>
                <p className="text-sm text-zinc-600 leading-relaxed">{displayContract.description}</p>
              </div>
            )}

            {/* Firmantes */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
                <User size={13} className="text-zinc-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex-1">Firmantes</p>
              </div>

              {/* Lista de firmantes */}
              <div className="divide-y divide-zinc-50">
                {detail?.signers?.length ? detail.signers.map((signer) => {
                  const meta = STATUS_LABELS[signer.status] ?? { label: signer.status, color: "text-zinc-500 bg-zinc-50 border-zinc-200" };
                  const canRemove = signer.status !== "SIGNED";
                  const isSigned = signer.status === "SIGNED";
                  return (
                    <div key={signer.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Avatar */}
                      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold ${isSigned ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {isSigned ? <Check size={14} strokeWidth={2.5} /> : (signer.name?.[0] ?? signer.email?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900 leading-tight">{signer.name || signer.email}</p>
                        <p className="truncate text-xs text-zinc-400">{signer.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                          {meta.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSigner(signer.id)}
                          disabled={!canRemove}
                          title={canRemove ? "Quitar firmante" : "No se puede quitar un firmante que ya firmó"}
                          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-20"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="px-4 py-4 text-xs text-zinc-400 italic text-center">
                    Todavía no hay firmantes asignados.
                  </div>
                )}
              </div>

              {/* Agregar firmante — colapsable */}
              <div className="border-t border-zinc-100">
                {addingSignerOpen ? (
                  <div className="p-3 space-y-2 bg-zinc-50/60">
                    <input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Nombre del firmante"
                      className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-400 transition"
                    />
                    <div className="flex gap-2">
                      <input
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="email@ejemplo.com"
                        type="email"
                        className="h-9 flex-1 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-400 transition"
                      />
                      <button
                        type="button"
                        onClick={async () => { await handleAddSigner(); setAddingSignerOpen(false); }}
                        disabled={!signerName.trim() || !signerEmail.trim() || savingSigner}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <UserPlus size={13} /> Agregar
                      </button>
                    </div>
                    {signerError && (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{signerError}</p>
                    )}
                    <button type="button" onClick={() => setAddingSignerOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600 transition">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingSignerOpen(true)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition"
                  >
                    <Plus size={13} /> Agregar firmante
                  </button>
                )}
              </div>
            </div>

            {/* Hash SHA-256 */}
            {displayContract.sha256Hash && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield size={13} className="text-zinc-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Huella SHA-256</p>
                </div>
                <p className="font-mono text-[10px] text-zinc-500 break-all leading-relaxed bg-zinc-50 rounded-xl p-2.5 border border-zinc-100 selection:bg-blue-100">
                  {displayContract.sha256Hash}
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Garantiza la inmutabilidad y validez legal del documento (Ley 25.506).
                </p>
              </div>
            )}
          </div>

          {/* ── Panel derecho: documento ── */}
          <div className="flex min-h-0 flex-col overflow-hidden bg-zinc-50">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-2.5 shrink-0">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <FileText size={12} />
                <span className="text-[11px] font-mono">{displayContract.fileName || "documento"}</span>
              </div>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
                >
                  Abrir PDF
                </a>
              )}
            </div>

            {/* Contenido — scroll propio */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="h-full w-full border-0"
                  style={{ minHeight: "60vh" }}
                  title="Vista previa del contrato"
                />
              ) : displayContract.templateId || displayContract.templateFields ? (
                /* Override del DocWrapper para que no tenga su propio scroll */
                <div className="[&_.contract-doc-wrapper]:max-h-none [&_.contract-doc-wrapper]:overflow-visible [&_.contract-doc-wrapper]:shadow-none [&_.contract-doc-wrapper]:border-0 [&_.contract-doc-wrapper]:rounded-none [&_.contract-doc-wrapper]:bg-transparent">
                  <ContractDocument
                    templateId={displayContract.templateId ?? "custom"}
                    fields={displayContract.templateFields ?? {}}
                    alumnos={detail?.signers?.map((s) => ({
                      nombre: s.name ?? "",
                      dni: "",
                      cuil: "",
                      email: s.email ?? "",
                      domicilio: "",
                    })) ?? []}
                    logoHeader
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
                  <div className="w-full max-w-xs rounded-2xl border border-zinc-200 bg-white p-6 space-y-3 mx-auto">
                    <div className="h-2.5 bg-zinc-200 rounded-full w-3/4 mx-auto" />
                    <div className="h-2 bg-zinc-100 rounded-full w-1/2 mx-auto mb-4" />
                    <div className="h-2 bg-zinc-100 rounded-full w-full" />
                    <div className="h-2 bg-zinc-100 rounded-full w-5/6" />
                    <div className="h-2 bg-zinc-100 rounded-full w-4/6" />
                  </div>
                  <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">Sin contenido disponible.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}

