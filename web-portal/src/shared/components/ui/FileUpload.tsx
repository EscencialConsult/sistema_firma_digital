import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";

type FileUploadProps = {
  label: string;
  hint?: string;
  accept?: string;
  onFile: (file: File) => void;
  preview?: string;
  loading?: boolean;
  disabled?: boolean;
};

export function FileUpload({
  label,
  hint,
  accept = "image/*",
  onFile,
  preview,
  loading,
  disabled,
}: FileUploadProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
        <img src={preview} alt="Vista previa" className="h-48 w-full object-cover" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <CheckCircle2 size={14} />
            Archivo cargado
          </div>
        </div>
        {!disabled && (
          <button
            onClick={() => ref.current?.click()}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            type="button"
            title="Cambiar imagen"
          >
            <X size={12} />
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : dragging
          ? "cursor-copy border-zinc-900 bg-zinc-100"
          : "cursor-pointer border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
      }`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100">
        {loading ? (
          <svg className="h-5 w-5 animate-spin text-zinc-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <ImagePlus size={22} className="text-zinc-500" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">{loading ? "Subiendo..." : label}</p>
        {hint && !loading && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
      </div>
      <p className="text-xs text-zinc-400">JPG, PNG o WEBP · máx. 5 MB</p>
      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
