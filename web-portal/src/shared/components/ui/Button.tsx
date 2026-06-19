import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  const styles = {
    primary: "primary-action",
    secondary: "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all duration-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition-all duration-200",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] transition-all duration-200"
  };
  
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };

  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

