import Link from "next/link";
import type { ReactNode } from "react";

/** A page's title block: optional back link above, optional meta line below, optional actions on the right. */
export function PageHeader({
  title,
  back,
  meta,
  actions,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const heading = (
    <div className="flex flex-col gap-1">
      {back && (
        <Link href={back.href} className="text-sm text-subtle hover:text-foreground">
          ← {back.label}
        </Link>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {meta && <p className="text-sm text-subtle">{meta}</p>}
    </div>
  );
  if (!actions) return heading;
  return (
    <div className="flex items-center justify-between gap-4">
      {heading}
      {actions}
    </div>
  );
}
