"use client";

import { useState, useTransition } from "react";
import { Button, Card, ErrorText, Input } from "@/components/ui";
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
    <Card aria-label="Share with client">
      <div>
        <h2 className="font-medium">Share with your client</h2>
        <p className="text-sm text-subtle">
          Anyone with this link can listen and leave comments, without an account. Revoking it cuts off
          access (already-open audio can keep playing for up to an hour).
        </p>
      </div>

      {url ? (
        <>
          <Input
            readOnly
            value={url}
            aria-label="Share link"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full font-mono text-sm"
          />
          <div className="flex items-center gap-3">
            <Button onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
            <Button
              variant="danger-link"
              disabled={pending}
              onClick={() => {
                if (confirm("Revoke this link? It stops working right away; audio someone already has open can keep playing for up to an hour. This can't be undone.")) {
                  run(() => revokeShareLink(songId));
                }
              }}
            >
              Revoke
            </Button>
          </div>
        </>
      ) : (
        <Button disabled={pending} onClick={() => run(() => createShareLink(songId))} className="w-fit">
          {pending ? "Creating…" : "Create share link"}
        </Button>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
