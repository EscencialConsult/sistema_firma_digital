import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

type OtpInputProps = {
  length?: number;
  onComplete: (code: string) => void;
  onChange?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
};

export function OtpInput({ length = 6, onComplete, onChange, disabled = false, error = false }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function handleChange(index: number, raw: string) {
    if (!/^\d*$/.test(raw)) return;
    const digit = raw.slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
    const code = next.join("");
    onChange?.(code);
    if (code.length === length && !code.includes("")) {
      onComplete(code);
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(length).fill("");
    pasted.split("").forEach((char, i) => {
      next[i] = char;
    });
    setValues(next);
    const target = Math.min(pasted.length, length - 1);
    inputs.current[target]?.focus();
    const code = next.join("");
    onChange?.(code);
    if (pasted.length === length) onComplete(pasted);
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={`h-12 w-10 rounded-xl border text-center text-lg font-bold tracking-widest transition focus:outline-none focus:ring-2 disabled:opacity-50 ${
            error
              ? "border-red-300 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-100"
              : "border-zinc-200 bg-white text-zinc-900 focus:border-zinc-900 focus:ring-zinc-100"
          }`}
        />
      ))}
    </div>
  );
}
