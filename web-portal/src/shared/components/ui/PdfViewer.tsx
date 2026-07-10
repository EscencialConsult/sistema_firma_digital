import { Download, FileSignature, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

interface PdfViewerProps {
  url: string | null;
  fileName?: string;
  signedUrl?: string | null;
  height?: string;
}

export function PdfViewer({ url, fileName, signedUrl, height = "h-[500px]" }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!url) {
    return (
      <div className="flex h-72 flex-col items-center justify-center bg-zinc-50 text-center px-8 rounded-2xl border border-zinc-200/60">
        <FileSignature size={40} className="text-zinc-300 mb-3" />
        <p className="text-sm font-semibold text-zinc-500">Vista previa no disponible</p>
        <p className="mt-1 text-xs text-zinc-400">
          El PDF no está disponible en este momento.
        </p>
      </div>
    );
  }

  const pdfUrl = url.startsWith("blob:") ? url : `${url}#toolbar=0&navpanes=0`;

  return (
    <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950">Documento</p>
          {fileName && (
            <p className="text-xs text-zinc-400 truncate max-w-[300px]">{fileName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const link = document.createElement("a");
              link.href = url;
              link.download = fileName || "documento.pdf";
              link.target = "_blank";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download size={13} />
            Descargar PDF
          </Button>
        </div>
      </div>

      <div className={`relative ${height} bg-zinc-100`}>
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 z-10">
            <Loader2 size={24} className="text-zinc-400 animate-spin" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 text-center px-8">
            <p className="text-sm font-semibold text-zinc-500">Error al cargar el PDF</p>
            <p className="mt-1 text-xs text-zinc-400">
              No se pudo cargar la vista previa. Usá el botón "Descargar PDF" para ver el documento.
            </p>
          </div>
        ) : (
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title={fileName || "PDF"}
            onLoad={() => setLoading(false)}
            onError={() => { setError(true); setLoading(false); }}
          />
        )}
      </div>
    </div>
  );
}
