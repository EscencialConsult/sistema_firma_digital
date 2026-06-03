import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
};

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98] transition-all duration-200",
    secondary: "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all duration-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all duration-200"
  };
  return (
    <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

