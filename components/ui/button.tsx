import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "destructive";

const styles: Record<Variant, string> = {
  primary: "bg-snow text-void hover:bg-steel",
  secondary: "border border-snow text-snow hover:bg-concrete",
  destructive: "border border-alert text-alert hover:bg-alert hover:text-void",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-sm px-6 font-mono text-xs uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
