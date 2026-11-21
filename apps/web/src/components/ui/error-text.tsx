import type { ReactNode } from "react";

/** An inline error under a control or action, announced to screen readers. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-danger" role="alert">
      {children}
    </p>
  );
}
