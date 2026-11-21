"use client";

import { useState, useTransition } from "react";
import { openSharedMix } from "./actions";

export function OpenButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await openSharedMix(token);
              if (r?.error) setError(r.error);
            } catch {
              setError("Couldn't reach the server. Try again.");
            }
          })
        }
        className="rounded-md bg-zinc-900 px-6 py-3 text-white disabled:opacity-50"
      >
        {pending ? "Opening…" : "Listen"}
      </button>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
