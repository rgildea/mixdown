import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "danger-link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-colors duration-[120ms] disabled:cursor-default disabled:opacity-50";

// `primary` is the one amber action per view. `secondary` (the default) is most buttons; `ghost` is for toolbars.
const variants: Record<ButtonVariant, string> = {
  primary: "rounded-control bg-primary text-on-primary hover:bg-primary-hover",
  secondary:
    "rounded-control bg-surface text-foreground ring-1 ring-line-strong ring-inset hover:bg-surface-raised hover:ring-line-active",
  ghost: "rounded-control text-muted hover:bg-surface-raised hover:text-foreground",
  link: "text-muted underline decoration-line-active underline-offset-4 hover:text-foreground",
  "danger-link": "text-danger underline underline-offset-4",
};

// Sizes apply to filled variants; link variants take the surrounding text size (`sm` sets text-sm).
const sizes: Record<ButtonSize, string> = {
  sm: "h-control px-4 text-sm",
  md: "h-control px-4",
  lg: "h-control-lg px-6",
};

/** Class names for a button-styled element; use when the element isn't a <button> or <Link>. */
export function buttonClasses({
  variant = "secondary",
  size = "sm",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  const isLink = variant === "link" || variant === "danger-link";
  // One weight per button, chosen here: two weight utilities would be decided by Tailwind's CSS order.
  const sizing = isLink
    ? size === "sm" && "text-sm"
    : cx(sizes[size], size === "lg" ? "font-semibold" : "font-medium");
  return cx(base, variants[variant], sizing, className);
}

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize };

/** A <button>. Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & StyleProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

/** A Next.js <Link> that looks like a button (or a link variant). */
export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
