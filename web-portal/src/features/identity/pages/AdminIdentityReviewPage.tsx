import { AlertCircle, CheckCircle2, ClipboardCheck, XCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi } from "../../admin/services/admin.api";
import { Button } from "../../../shared/components/ui/Button";
import { EmptyState } from "../../../shared/components/ui/EmptyState";
import { PageHeader } from "../../../shared/components/ui/PageHeader";
import { useApiResource } from "../../../shared/hooks/useApiResource";
import { supabase } from "../../../shared/lib/supabase";
import { AdminVerificationCard } from "../components/AdminVerificationCard";
import type { IdentityDocument, IdentityVerification } from "../types/identity.types";

const IDENTITY_BUCKET = "kyc-documents";

function DocumentImage({ document, alt, className }: { document: IdentityDocument; alt?: string; className?: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!document.storagePath) {
        setError(true);
        setLoading(false);
        return;
      }
      const { data, error: signedError } = await supabase.storage
        .from(IDENTITY_BUCKET)
        .createSignedUrl(document.storagePath, 3600);
      if (cancelled) return;
      if (signedError || !data?.signedUrl) {
        console.error("Error creating signed URL:", signedError);
        setError(true);
        setLoading(false);
        return;
      }
      setImgSrc(data.signedUrl);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [document.storagePath]);

  if (loading) {
    return (
      <div className={`${className} bg-zinc-50 flex items-center justify-center text-[10px] text-zinc-400 font-medium animate-pulse`}>
        Cargando...
      </div>
    );
  }

  if (error || !imgSrc) {
    return (
      <div className={`${className} bg-rose-50 border border-rose-100 flex items-center justify-center text-[10px] text-rose-500 font-medium text-center p-1`}>
        Error de carga
      </div>
    );
  }

  return <img src={imgSrc} alt={alt} className={className} />;
}

interface IdentityReviewModalProps {
  verification: IdentityVerification;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  reviewing: boolean;
  setLightboxDocument: (doc: IdentityDocument) => void;
  setLightboxTitle: (title: string) => void;
}

function IdentityReviewModal({
  verification,
  onClose,
  onApprove,
  onReject,
  reviewing,
  setLightboxDocument,
  setLightboxTitle
}: IdentityReviewModalProps) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px] overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200/50 bg-white shadow-2xl overflow-hidden flex flex-col my-8 max-h-[85vh]">
        <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-zinc-950">{verification.fullName || "Solicitud de validaci?n"}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{verification.documentType || "Documento"} {verification.documentNumber || ""}</p>
          </div>
          <button
            type="button"
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-6 overflow-y-auto flex-1 grid gap-6 md:grid-cols-2">
          {/* Left column: Declared data & Documents */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 font-semibold">Datos Declarados</h3>
              <div className="rounded-2xl border border-zinc-200/50 p-4 space-y-2.5 text-xs bg-zinc-50/10">
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500 font-medium">Email</dt>
                  <dd className="font-semibold text-zinc-900">{verification.email || "Sin declarar"}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500 font-medium">CUIT/CUIL</dt>
                  <dd className="font-semibold text-zinc-900 font-mono">{verification.cuitCuil || "Sin declarar"}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500 font-medium">Nacionalidad</dt>
                  <dd className="font-semibold text-zinc-900">{verification.nationality || "Sin declarar"}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500 font-medium">Provincia</dt>
                  <dd className="font-semibold text-zinc-900">{verification.province || "Sin declarar"}</dd>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500 font-medium">Ciudad</dt>
                  <dd className="font-semibold text-zinc-900">{verification.city || "Sin declarar"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500 font-medium">Direcci?n</dt>
                  <dd className="font-semibold text-zinc-900 truncate max-w-[200px]" title={verification.address}>{verification.address || "Sin declarar"}</dd>
                </div>
              </div>
            </div>

            {/* Interactive Documents Preview Grid */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 font-semibold">Documentaci?n cargada</h3>
              <div className="grid grid-cols-3 gap-3">
                {["DOCUMENT_FRONT", "DOCUMENT_BACK", "SELFIE"].map((type) => {
                  const document = verification.documents?.find((item) => item.type === type);
                  const label = type === "DOCUMENT_FRONT" ? "Frente DNI" : type === "DOCUMENT_BACK" ? "Dorso DNI" : "Selfie";
                  
                  if (!document) {
                    return (
                      <div key={type} className="flex flex-col items-center justify-center aspect-square rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/20 p-3 text-center">
                        <span className="text-[10px] font-semibold text-zinc-400">{label}</span>
                        <span className="text-[9px] text-zinc-400 mt-1 font-medium italic">Sin cargar</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={type} 
                      className="group relative aspect-square rounded-2xl border border-zinc-200/50 overflow-hidden bg-zinc-50 cursor-pointer shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] hover-lift transition-all focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
                      type="button"
                      onClick={() => {
                        setLightboxDocument(document);
                        setLightboxTitle(`${verification.fullName || "Validacion"} - ${label}`);
                      }}
                    >
                      <DocumentImage 
                        document={document}
                        alt={label} 
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                        <span className="text-[9px] font-bold text-white block truncate">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-400 font-medium mt-2">Haga clic en cualquiera de las imágenes para expandir su tamaño y auditar los datos legibles.</p>
            </div>
          </div>

          {/* Right column: Audit trail logs & actions */}
          <div className="flex flex-col h-full justify-between space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 font-semibold">Historial de Auditoría</h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {verification.auditLogs?.length ? verification.auditLogs.map((event) => (
                  <div key={event.id} className="relative border-l border-zinc-100 pl-4 pb-4 last:pb-0 text-xs">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-900 border-2 border-white ring-1 ring-zinc-200/50" />
                    <p className="font-bold text-zinc-900">{event.action}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(event.createdAt).toLocaleString()}</p>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <pre className="mt-1 bg-zinc-50 border border-zinc-100 rounded-lg p-2 text-[9px] text-zinc-500 font-mono overflow-x-auto max-w-full">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )) : <p className="text-xs text-zinc-500 italic">Sin eventos de auditoría registrados.</p>}
              </div>
            </div>

            {/* Validation Actions inside Modal */}
            {verification.status === "IN_REVIEW" || verification.status === "PENDING" ? (
              <div className="flex gap-3 border-t border-zinc-100 pt-5">
                <Button 
                  type="button" 
                  className="bg-zinc-950 text-white hover:bg-zinc-900 flex-1 justify-center rounded-xl h-10 text-xs font-semibold"
                  disabled={reviewing} 
                  onClick={onApprove}
                >
                  <CheckCircle2 size={15} /> Aprobar Identidad
                </Button>
                <Button 
                  variant="secondary" 
                  type="button" 
                  className="border border-rose-200 text-rose-700 bg-rose-50/20 hover:bg-rose-50/50 flex-1 justify-center rounded-xl h-10 text-xs font-semibold"
                  disabled={reviewing} 
                  onClick={onReject}
                >
                  <XCircle size={15} /> Rechazar Solicitud
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-100 p-4 bg-zinc-50/30 text-xs text-zinc-500 font-medium">
                Esta solicitud se encuentra en estado <strong className="text-zinc-900">{verification.status}</strong>. No requiere más acciones directas.
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end border-t border-zinc-100 px-6 py-4 bg-zinc-50/50 sticky bottom-0 z-10">
          <Button variant="secondary" onClick={onClose}>Cerrar Solicitud</Button>
        </footer>
      </div>
    </div>
  );
}

export function AdminIdentityReviewPage() {
  const { data, loading, error, reload } = useApiResource(adminApi.identityVerifications, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  // Rejection modal states
  const [rejectingVerification, setRejectingVerification] = useState<IdentityVerification | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // Approval modal states
  const [approvingVerification, setApprovingVerification] = useState<IdentityVerification | null>(null);

  // Lightbox modal states
  const [lightboxDocument, setLightboxDocument] = useState<IdentityDocument | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState("");

  const selected = data?.find((verification) => verification.id === selectedId) ?? null;

  function startReject(verification: IdentityVerification) {
    setRejectingVerification(verification);
    setRejectionReasonInput("");
  }

  function startApprove(verification: IdentityVerification) {
    setApprovingVerification(verification);
  }

  async function submitApprove() {
    if (!approvingVerification) return;
    setReviewing(true);
    try {
      await adminApi.approveIdentity(approvingVerification.id);
      setApprovingVerification(null);
      setSelectedId(null); // Close modal on success
      await reload();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Ocurrió un error al aprobar la verificación.");
    } finally {
      setReviewing(false);
    }
  }

  async function submitReject() {
    if (!rejectingVerification || !rejectionReasonInput.trim()) return;
    setReviewing(true);
    try {
      await adminApi.rejectIdentity(rejectingVerification.id, rejectionReasonInput);
      setRejectingVerification(null);
      setSelectedId(null); // Close main review modal too
      await reload();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Ocurrió un error al rechazar la verificación.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin KYC"
        title="Revisión de identidades"
        description="Cola de validación de identidad. Haga clic en 'Revisar' en cualquier solicitud para auditarla."
      />

      {loading ? <p className="text-sm text-zinc-500">Cargando solicitudes de verificación...</p> : null}
      {error ? <EmptyState icon={AlertCircle} title="No se pudieron cargar verificaciones" description={error} /> : null}
      {!loading && !error && !data?.length ? (
        <EmptyState icon={ClipboardCheck} title="Cola vacía" description="No hay solicitudes de verificación de identidad pendientes de revisión." />
      ) : null}

      {!loading && data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((verification) => (
            <AdminVerificationCard 
              key={verification.id} 
              verification={verification} 
              onOpen={() => setSelectedId(verification.id)} 
              isSelected={verification.id === selectedId}
            />
          ))}
        </div>
      )}

      {/* Main Review Modal */}
      {selected ? (
        <IdentityReviewModal 
          verification={selected}
          onClose={() => setSelectedId(null)}
          onApprove={() => startApprove(selected)}
          onReject={() => startReject(selected)}
          reviewing={reviewing}
          setLightboxDocument={setLightboxDocument}
          setLightboxTitle={setLightboxTitle}
        />
      ) : null}

      {/* Lightbox Modal */}
      {lightboxDocument ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/80 p-4 backdrop-blur-[2px]">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-white">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">{lightboxTitle}</h3>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
                onClick={() => setLightboxDocument(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="p-6 overflow-auto flex-1 flex justify-center bg-zinc-50">
              <DocumentImage 
                document={lightboxDocument}
                alt={lightboxTitle} 
                className="max-h-[60vh] object-contain rounded-lg border border-zinc-200/50 shadow-md" 
              />
            </div>
            <footer className="flex justify-end border-t border-zinc-100 px-6 py-4 bg-zinc-50/50">
              <Button variant="secondary" onClick={() => setLightboxDocument(null)}>Cerrar Previsualización</Button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Rejection Modal */}
      {rejectingVerification ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200/50 bg-white shadow-2xl overflow-hidden flex flex-col">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Rechazar Identidad</h3>
                <p className="text-xs text-zinc-500 mt-0.5 font-medium">Indique el motivo detallado de rechazo para el usuario.</p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
                onClick={() => setRejectingVerification(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Motivo de Rechazo</label>
                <textarea
                  className="w-full h-28 rounded-xl border border-zinc-200 p-3 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 placeholder-zinc-400 resize-none font-medium text-zinc-800"
                  placeholder="Ej: La imagen del frente del DNI está borrosa y no se leen los datos personales..."
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                />
              </div>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 bg-zinc-50/50">
              <Button variant="secondary" onClick={() => setRejectingVerification(null)}>Cancelar</Button>
              <Button 
                variant="danger" 
                onClick={submitReject} 
                disabled={!rejectionReasonInput.trim() || reviewing}
              >
                {reviewing ? "Rechazando..." : "Rechazar Verificación"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Approval Confirmation Modal */}
      {approvingVerification ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200/50 bg-white shadow-2xl overflow-hidden flex flex-col">
            <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Aprobar Identidad</h3>
                <p className="text-xs text-zinc-500 mt-0.5 font-medium">Confirmación de emisión de firma digital.</p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 active:scale-95 transition-all"
                onClick={() => setApprovingVerification(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="p-6 space-y-3">
              <p className="text-xs font-medium text-zinc-600 leading-relaxed">
                ¿Está seguro de aprobar la identidad de <strong className="text-zinc-900 font-bold">{approvingVerification.fullName}</strong>?
              </p>
              <p className="text-xs font-medium text-zinc-500 leading-relaxed bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                Al confirmar, se emitirá automáticamente su certificado criptográfico y se le notificará que ya se encuentra habilitado para firmar documentos digitalmente.
              </p>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 bg-zinc-50/50">
              <Button variant="secondary" onClick={() => setApprovingVerification(null)}>Cancelar</Button>
              <Button 
                className="bg-zinc-950 text-white hover:bg-zinc-900 rounded-xl h-10 text-xs font-semibold px-4"
                onClick={submitApprove} 
                disabled={reviewing}
              >
                {reviewing ? "Aprobando..." : "Confirmar y Aprobar"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
