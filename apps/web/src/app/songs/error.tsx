"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

// Next 16: boundaries receive `retry` (re-fetch + re-render), and `error` may not be an Error.
export default function SongsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-zinc-600">This page couldn&apos;t load. It&apos;s probably temporary.</p>
      <div className="flex items-center gap-4">
        <button onClick={() => retry()} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
          Try again
        </button>
        <Link href="/songs" className="text-sm underline underline-offset-4">
          Back to songs
        </Link>
      </div>
      {digest && <p className="text-xs text-zinc-400">Error ID: {digest}</p>}
    </main>
  );
}
