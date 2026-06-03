import type { Dispatch, SetStateAction } from "react";
import { FileDropzone } from "./FileDropzone";
import type { IdentityDocumentType } from "../types/identity.types";

export function SelfieUploadStep({ files, setFiles }: { files: Record<IdentityDocumentType, File | null>; setFiles: Dispatch<SetStateAction<Record<IdentityDocumentType, File | null>>> }) {
  return (
    <div className="grid gap-4">
      <FileDropzone label="Selfie actual" file={files.SELFIE} onChange={(file) => setFiles((current) => ({ ...current, SELFIE: file }))} />
      <div className="rounded-xl border border-amber-100/60 bg-amber-50/40 p-4 text-xs font-medium text-amber-900 leading-relaxed">
        En el MVP la revisión es manual. La arquitectura queda lista para liveness detection y face matching.
      </div>
    </div>
  );
}

