import type { ComponentProps } from "react";
import { cx } from "./cx";

/** A bordered section: the mix player, the share panel. Give it an aria-label so it's a named region. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("flex flex-col gap-3 rounded-card border border-line bg-surface p-4", className)} {...props} />;
}
