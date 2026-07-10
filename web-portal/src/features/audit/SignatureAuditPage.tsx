import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Fingerprint,
  Hash,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../shared/components/ui/Button";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { getSignatureAuditData, type SignatureAuditData } from "../../shared/services/audit.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function SignatureAuditPage() {
  const { signatureId } = useParams<{ signatureId: string }>();
  const navigate = useNavigate();
  const [data, setData]     = useState<SignatureAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!signatureId) return;
    getSignatureAuditData(signatureId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar auditoría"))
      .finally(() => setLoading(false));
  }, [signatureId]);

  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Loader2 size={22} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 transition">
          <ArrowLeft size={14} /> Volver
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error ?? "No se encontró la auditoría de firma."}
        </div>
      </div>
    );
  }

  const isSigned = data.status === "SIGNED";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-800 transition">
          <ArrowLeft size={15} />
        </button>
        <PageHeader
          eyebrow="Auditoría de firma"
          title={data.documentTitle}
          description={`Firmante: ${data.signerName} · ${formatDate(data.signedAt ?? data.sentAt)}`}
        />
      </div>

      {/* Estado */}
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
        isSigned
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}>
        {isSigned ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        {isSigned ? "Firma electrónica registrada" : `Estado: ${data.status}`}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datos del firmante */}
        <Section title="Datos del firmante" icon={User}>
          <Field label="Nombre completo" value={data.fullName ?? data.signerName} />
          <Field label="Email" value={data.email ?? data.signerEmail} />
          <Field label="Documento" value={data.documentNumber ?? "—"} />
          <Field label="CUIL/CUIT" value={data.cuilCuit ?? "—"} />
          <Field label="Dirección" value={data.address ?? "—"} />
          <Field label="Ciudad" value={data.city ?? "—"} />
          <Field label="Provincia" value={data.province ?? "—"} />
          <Field label="Teléfono" value={data.phone ?? "—"} />
          <Field label="Fecha de nacimiento" value={data.birthDate ?? "—"} />
        </Section>

        {/* Datos de la firma */}
        <Section title="Datos de la firma" icon={Fingerprint}>
          <Field label="Fecha y hora" value={data.signedAt ? formatDate(data.signedAt) : "—"} />
          <Field label="Dirección IP" value={data.ipAddress ?? "—"} />
          <Field label="Dispositivo" value={data.userAgent ?? "—"} />
          <Field label="Hash SHA-256" value={data.documentHash ?? "—"} mono />
        </Section>

        {/* Verificación de identidad */}
        <Section title="Verificación de identidad" icon={ShieldCheck}>
          <Field label="Método" value={data.faceVerificationMethod ?? "—"} />
          <Field label="Score de similitud" value={data.faceSimilarityScore ? `${data.faceSimilarityScore}%` : "—"} />
          <Field label="Código de verificación" value={data.verificationCode ?? "—"} />
        </Section>

        {/* Certificado digital */}
        <Section title="Certificado digital" icon={Hash}>
          <Field label="Serial del certificado" value={data.certificateSerial ?? "—"} mono />
          <Field label="Emisor" value="Escencial Consultora S.A.S." />
          <Field label="Ley aplicable" value="Ley N° 25.506 de Firma Digital" />
        </Section>
      </div>

      {/* Firma manuscrita */}
      {data.signatureUrl && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Fingerprint size={15} className="text-zinc-400" />
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Firma manuscrita</p>
          </div>
          <div className="flex justify-center py-4">
            <img src={data.signatureUrl} alt="Firma manuscrita" className="max-h-32 object-contain" />
          </div>
        </div>
      )}

      {/* PDF de auditoría */}
      {data.pdfUrl && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-zinc-400" />
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">PDF de auditoría</p>
          </div>
          <a
            href={data.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition"
          >
            <FileText size={14} /> Descargar PDF de auditoría
          </a>
        </div>
      )}

      {/* Texto legal */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
        <p className="text-xs text-blue-700 leading-relaxed">
          La presente auditoría certifica que <strong>{data.fullName ?? data.signerName}</strong> realizó la firma electrónica del documento <strong>{data.documentTitle}</strong> en la fecha y hora indicadas, cumpliendo con los requisitos de la Ley N° 25.506 de Firma Digital. El hash SHA-256 del documento garantiza la inmutabilidad del contenido firmado.
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-zinc-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{title}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-zinc-900 text-right ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </span>
    </div>
  );
}
