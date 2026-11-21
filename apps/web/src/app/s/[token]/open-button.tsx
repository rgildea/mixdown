"use client";

import { useState, useTransition } from "react";
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { redeemSharedMix } from "./actions";

export function OpenButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    start(async () => {
      setError(null);
      try {
        // Sign in anonymously IN THE BROWSER, only if there's no valid session yet, so the rate limit
        // is per visitor. The session cookie is then sent with the Server Action below.
        // getUser() checks the session with Supabase (getSession() only reads the cookie). Only a
        // definite "no session" or "this session/user is gone" (401/403, e.g. its anonymous user was
        // cleaned up) replaces the session. Any other error (offline, 5xx, 429) keeps it: dropping it
        // would lose the client's earlier grants, or log an engineer out over a network blip.
        const supabase = createClient();
        const { data, error: userError } = await supabase.auth.getUser();
        if (!data.user) {
          const noSession = !userError || isAuthSessionMissingError(userError);
          const deadSession =
            isAuthApiError(userError) && (userError.status === 401 || userError.status === 403);
          if (!noSession && !deadSession) {
            setError("Couldn't reach the server. Try again.");
            return;
          }
          if (deadSession) await supabase.auth.signOut({ scope: "local" });
          const { error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) {
            setError(
              signInError.status === 429
                ? "Too many listening sessions were started from your network. Try again in a few minutes."
                : "Couldn't start your listening session. Try again.",
            );
            return;
          }
        }
        const r = await redeemSharedMix(token);
        if (r?.error) setError(r.error);
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={open}
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
