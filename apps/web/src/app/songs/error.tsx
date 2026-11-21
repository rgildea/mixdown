"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button, ButtonLink, PageHeader } from "@/components/ui";

// Next 16: boundaries receive `retry` (re-fetch + re-render), and `error` may not be an Error.
export default function SongsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <main className="flex flex-col gap-3">
      <PageHeader title="Something went wrong" />
      <p className="text-muted">This page couldn&apos;t load. It&apos;s probably temporary.</p>
      <div className="flex items-center gap-4">
        <Button variant="primary" onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/songs" variant="link">
          Back to songs
        </ButtonLink>
      </div>
      {digest && <p className="text-xs text-faint">Error ID: {digest}</p>}
    </main>
  );
}
