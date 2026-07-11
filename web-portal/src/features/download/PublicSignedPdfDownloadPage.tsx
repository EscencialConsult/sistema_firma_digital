import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";

export function PublicSignedPdfDownloadPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setError("Link de descarga invalido.");
      return;
    }

    supabase.functions
      .invoke("download-signed-contract", {
        body: { documentId },
      })
      .then(({ data, error }) => {
        if (error) throw error;
        const url = data?.url as string | undefined;
        if (!url) throw new Error("No se encontro el PDF firmado.");
        window.location.replace(url);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo abrir el PDF firmado.");
      });
  }, [documentId]);

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50 p-6">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Descarga</p>
        <h1 className="mt-2 text-xl font-bold text-zinc-950">
          {error ? "No se pudo abrir el PDF" : "Preparando PDF firmado..."}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {error ?? "En unos segundos se va a abrir el documento."}
        </p>
      </div>
    </div>
  );
}
