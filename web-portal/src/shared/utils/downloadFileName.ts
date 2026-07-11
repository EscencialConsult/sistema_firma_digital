const WINDOWS_FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

function baseName(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  return raw
    .replace(/\.pdf$/i, "")
    .replace(WINDOWS_FORBIDDEN_CHARS, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
}

export function signedPdfFileName(input: {
  title?: string | null;
  fileName?: string | null;
  sequence?: number | null;
}): string {
  const base = baseName(input.fileName) || baseName(input.title) || "documento";
  const sequence = Number.isFinite(input.sequence)
    ? Math.max(1, Math.floor(input.sequence as number)).toString().padStart(3, "0")
    : "001";
  return `${base}_${sequence}.pdf`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function signedPdfDownloadUrl(documentId: string): string {
  return `${window.location.origin}/d/${documentId}`;
}
