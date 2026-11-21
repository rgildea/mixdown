import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Text input. Read-only inputs get the surface background. */
export function Input({ className, readOnly, ...props }: ComponentProps<"input">) {
  return (
    <input
      readOnly={readOnly}
      className={cx("rounded-control border border-line-strong px-3 py-2", readOnly && "bg-surface", className)}
      {...props}
    />
  );
}
