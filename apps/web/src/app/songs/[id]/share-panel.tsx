"use client";

import { useState, useTransition } from "react";
import { createShareLink, revokeShareLink } from "./share-actions";

export function SharePanel({ songId, url }: { songId: string; url: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      setCopied(false);
      try {
        const r = await action();
        if (!r.ok) setError(r.error ?? "Something went wrong.");
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the link and copy it manually.");
    }
  }

  return (
    <section aria-label="Share with client" className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
      <div>
        <h2 className="font-medium">Share with your client</h2>
        <p className="text-sm text-zinc-500">
          Anyone with this link can listen and leave comments, without an account. Revoke it to cut off access.
        </p>
      </div>

      {url ? (
        <>
          <input
            readOnly
            value={url}
            aria-label="Share link"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={copy}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm("Revoke this link? Anyone using it loses access immediately.")) {
                  run(() => revokeShareLink(songId));
                }
              }}
              className="text-sm text-red-700 underline underline-offset-4 disabled:opacity-50"
            >
              Revoke
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createShareLink(songId))}
          className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create share link"}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
