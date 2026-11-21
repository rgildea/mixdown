import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Text input. Read-only inputs sit in the sunken well with muted text. */
export function Input({ className, readOnly, ...props }: ComponentProps<"input">) {
  return (
    <input
      readOnly={readOnly}
      className={cx(
        "h-control rounded-control border border-line-strong bg-surface px-3 text-foreground placeholder:text-faint",
        "hover:border-line-active focus-visible:border-focus-ring focus-visible:outline-offset-0",
        readOnly && "bg-surface-sunken text-muted",
        className,
      )}
      {...props}
    />
  );
}
