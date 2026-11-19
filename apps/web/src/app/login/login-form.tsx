"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
        If <strong>{state.email}</strong> has an account, a sign-in link is on its way. Open it in
        this browser.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={state.email}
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
      {state.status === "error" && (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
