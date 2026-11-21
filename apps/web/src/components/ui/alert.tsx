import type { ReactNode } from "react";
import { cx } from "./cx";

const tones = {
  danger: { className: "bg-danger-surface text-danger-strong", role: "alert" },
  success: { className: "bg-success-surface text-success", role: "status" },
} as const;

/** A boxed message for a page-level outcome (a failed sign-in link, a sent email). */
export function Alert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const t = tones[tone];
  return (
    <p className={cx("rounded-control p-4 text-sm", t.className)} role={t.role}>
      {children}
    </p>
  );
}
