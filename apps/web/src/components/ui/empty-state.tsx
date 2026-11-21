import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/** A dashed placeholder for something that isn't there yet (no mix uploaded). */
export function EmptyState({
  title,
  description,
  className,
  ...props
}: { title: ReactNode; description?: ReactNode } & Omit<ComponentProps<"section">, "title">) {
  return (
    <section
      className={cx("rounded-card border border-dashed border-line-strong p-6 text-center", className)}
      {...props}
    >
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-subtle">{description}</p>}
    </section>
  );
}
