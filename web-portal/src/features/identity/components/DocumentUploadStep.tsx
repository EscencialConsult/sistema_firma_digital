import type { Dispatch, SetStateAction } from "react";
import { FileDropzone } from "./FileDropzone";
import type { IdentityDocumentType } from "../types/identity.types";

export function DocumentUploadStep({ files, setFiles }: { files: Record<IdentityDocumentType, File | null>; setFiles: Dispatch<SetStateAction<Record<IdentityDocumentType, File | null>>> }) {
  return (
    <div className="grid gap-4">
      <FileDropzone label="Frente del DNI" file={files.DOCUMENT_FRONT} onChange={(file) => setFiles((current) => ({ ...current, DOCUMENT_FRONT: file }))} />
      <FileDropzone label="Dorso del DNI" file={files.DOCUMENT_BACK} onChange={(file) => setFiles((current) => ({ ...current, DOCUMENT_BACK: file }))} />
      <div className="rounded-xl border border-zinc-150/40 bg-zinc-50/40 p-4 text-xs text-zinc-500 font-medium leading-relaxed">
        Los archivos se almacenan en storage privado; el backend no expone URLs públicas directas.
      </div>
    </div>
  );
}

