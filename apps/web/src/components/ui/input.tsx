import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Text input. Read-only inputs sit in the sunken well with muted text. */
export function Input({ className, readOnly, ...props }: ComponentProps<"input">) {
  return (
    <input
      readOnly={readOnly}
      className={cx(
        "h-control rounded-control border border-line-strong px-3 placeholder:text-faint",
        "hover:border-line-active focus-visible:border-focus-ring focus-visible:outline-offset-0",
        // Either/or, never both: cx() doesn't merge classes, so two utilities for one property would
        // be decided by Tailwind's CSS order, not by the order here.
        readOnly ? "bg-surface-sunken text-muted" : "bg-surface text-foreground",
        className,
      )}
      {...props}
    />
  );
}
