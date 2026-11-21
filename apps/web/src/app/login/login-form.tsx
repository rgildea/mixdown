"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <Alert tone="success">
        If <strong>{state.email}</strong> has an account, a sign-in link is on its way. Open it in
        this browser.
      </Alert>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email" error={state.status === "error" ? state.message : undefined}>
        <Input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email} />
      </Field>
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
