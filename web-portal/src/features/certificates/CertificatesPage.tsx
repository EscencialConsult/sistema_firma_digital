import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle, Download, KeyRound, Plus, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "../../shared/components/ui/Badge";
import { Button } from "../../shared/components/ui/Button";
import { Card } from "../../shared/components/ui/Card";
import { EmptyState } from "../../shared/components/ui/EmptyState";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { useApiResource } from "../../shared/hooks/useApiResource";
import { certificatesApi } from "./services/certificates.api";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "sin vencimiento";
}

function filenameFromLabel(label: string) {
  return `${label.replace(/[^\w.\- ]+/g, "_")}.p12`;
}

export function CertificatesPage() {
  const { data, loading, error, reload } = useApiResource(certificatesApi.list, []);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Certificado personal");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function handleCreateCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await certificatesApi.create({ label, type: "P12", password });
      setPassword("");
      setShowForm(false);
      setActionMessage("Certificado P12 emitido correctamente. Ya podes descargarlo o usarlo para firmar.");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo emitir el certificado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(id: string, status: "ACTIVE" | "INACTIVE" | "REVOKED") {
    setActionError(null);
    setActionMessage(null);
    try {
      await certificatesApi.updateStatus(id, status);
      setActionMessage(status === "REVOKED" ? "Certificado revocado." : "Estado del certificado actualizado.");
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo actualizar el certificado.");
    }
  }

  async function handleDownload(id: string, certificateLabel: string) {
    setActionError(null);
    try {
      await certificatesApi.download(id, filenameFromLabel(certificateLabel));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo descargar el certificado.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Identidad digital"
        title="Mis certificados"
        description="Emiti certificados P12 protegidos por contrasena para aplicar firmas digitales sobre documentos PDF."
        action={<Button type="button" onClick={() => setShowForm((value) => !value)}><Plus size={16} /> Emitir certificado</Button>}
      />

      {actionError ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <AlertCircle size={16} /> {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          <CheckCircle size={16} /> {actionMessage}
        </div>
      ) : null}

      {showForm ? (
        <Card className="mb-6 p-5">
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={handleCreateCertificate}>
            <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
              Nombre del certificado
              <input
                className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                minLength={2}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
              Contrasena P12
              <input
                className="h-10 rounded-xl border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <Button type="submit" disabled={submitting || password.length < 8}>
              <ShieldCheck size={16} /> {submitting ? "Emitiendo..." : "Emitir P12"}
            </Button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Guarda esta contrasena: protege el archivo P12 que vas a descargar y tambien permite que el portal lo use al firmar.
          </p>
        </Card>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Cargando certificados...</p> : null}
      {error ? <EmptyState icon={AlertCircle} title="No se pudieron cargar certificados" description={error} /> : null}
      {!loading && !error && !data?.length ? (
        <EmptyState icon={KeyRound} title="Sin certificados" description="Emiti tu primer P12 para firmar documentos digitalmente." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((certificate) => (
          <Card key={certificate.id} className="p-5 hover-lift">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-200/50 bg-zinc-100 text-zinc-700">
                <KeyRound size={20} />
              </div>
              <Badge status={certificate.status} />
            </div>
            <h2 className="mt-5 font-bold text-zinc-950">{certificate.label}</h2>
            <p className="mt-2 text-sm text-zinc-500">{certificate.type} - {certificate.issuer ?? "sin emisor"}</p>
            <div className="mt-4 space-y-1 text-xs font-semibold text-zinc-400">
              <p>Serie: {certificate.serial_number ?? "sin serie"}</p>
              <p>Vigencia: {formatDate(certificate.valid_from)} - {formatDate(certificate.valid_to)}</p>
              <p className="truncate" title={certificate.fingerprint_sha256}>SHA-256: {certificate.fingerprint_sha256?.slice(0, 20) ?? "sin huella"}...</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="h-9 rounded-lg px-3 text-xs" onClick={() => handleDownload(certificate.id, certificate.label)}>
                <Download size={14} /> Descargar
              </Button>
              {certificate.status === "ACTIVE" ? (
                <Button type="button" variant="secondary" className="h-9 rounded-lg px-3 text-xs" onClick={() => handleStatus(certificate.id, "INACTIVE")}>
                  <XCircle size={14} /> Desactivar
                </Button>
              ) : (
                <Button type="button" variant="secondary" className="h-9 rounded-lg px-3 text-xs" onClick={() => handleStatus(certificate.id, "ACTIVE")}>
                  <CheckCircle size={14} /> Activar
                </Button>
              )}
              <Button type="button" variant="danger" className="h-9 rounded-lg px-3 text-xs" onClick={() => handleStatus(certificate.id, "REVOKED")}>
                Revocar
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
