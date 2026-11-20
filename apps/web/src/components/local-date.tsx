"use client";

/** Renders a timestamp as a date in the viewer's own time zone. */
export function LocalDate({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })}
    </time>
  );
}
