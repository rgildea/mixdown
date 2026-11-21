import type { ReactNode } from "react";
import { ErrorText } from "./error-text";

/** A labelled form control with optional hint and error. `htmlFor` must match the control's id. */
export function Field({
  label,
  htmlFor,
  optional,
  hint,
  hintId,
  error,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  optional?: boolean;
  hint?: ReactNode;
  /** Set when the control references the hint with aria-describedby. */
  hintId?: string;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-subtle"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
