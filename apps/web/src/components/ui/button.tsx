import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "link" | "danger-link";
export type ButtonSize = "sm" | "md" | "lg";

const base = "cursor-pointer disabled:cursor-default disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "rounded-control bg-primary text-on-primary hover:bg-primary-hover",
  link: "underline underline-offset-4 hover:text-foreground",
  "danger-link": "text-danger underline underline-offset-4",
};

// Sizes apply to `primary` only; link variants take the surrounding text size (`sm` sets text-sm).
const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-4 py-2",
  lg: "px-6 py-3",
};

/** Class names for a button-styled element; use when the element isn't a <button> or <Link>. */
export function buttonClasses({
  variant = "primary",
  size = "sm",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  const sizing = variant === "primary" ? sizes[size] : size === "sm" ? "text-sm" : undefined;
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
