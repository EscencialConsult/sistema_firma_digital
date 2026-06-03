import { UploadCloud } from "lucide-react";

export function FileDropzone({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="block rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40 p-5 transition hover:bg-zinc-50/80 hover:border-zinc-350 cursor-pointer transition-all duration-200">
      <input
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-zinc-600 shadow-sm border border-zinc-100">
          <UploadCloud size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-950">{label}</p>
          <p className="mt-1 text-xs text-zinc-500">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "JPG, PNG o WEBP hasta el máximo permitido"}</p>
        </div>
      </div>
    </label>
  );
}

