import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { ArrowRightIcon } from "@/components/icons";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "inverse";
type Size = "md" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-canvas hover:bg-muted",
  secondary: "border border-ink/70 text-ink hover:border-ink hover:bg-ink hover:text-canvas",
  ghost: "text-ink hover:text-muted",
  destructive: "border border-alert text-alert hover:bg-alert hover:text-canvas",
  /** Light button for use on an ink band. */
  inverse: "bg-canvas text-ink hover:bg-line",
};

const sizes: Record<Size, string> = {
  md: "h-12 px-7 text-[11px]",
  sm: "h-9 px-4 text-[10px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className = "") {
  return `inline-flex items-center justify-center gap-3 rounded-sm font-mono uppercase tracking-[0.16em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

/** Link styled as a button, with the brand's trailing arrow. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  arrow = true,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; arrow?: boolean }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
      {arrow && <ArrowRightIcon width={14} height={14} />}
    </Link>
  );
}
