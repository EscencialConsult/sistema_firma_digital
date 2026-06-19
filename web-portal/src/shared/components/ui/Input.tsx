import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
  error?: string;
  inputSize?: "sm" | "md" | "lg";
};

export function Input({ label, icon, error, inputSize = "md", className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-3.5 py-2.5 text-sm",
    lg: "px-4 py-3.5 text-base"
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wide text-zinc-600"
        >
          {label}
        </label>
      )}
      <div
        className={`flex items-center gap-2.5 rounded-[var(--radius-button)] border bg-white transition-all duration-200 focus-within:ring-2 ${sizes[inputSize]} ${
          error
            ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
            : "border-zinc-200 focus-within:border-zinc-500 focus-within:ring-zinc-100"
        }`}
      >
        {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
        <input
          id={inputId}
          className={`w-full bg-transparent outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
