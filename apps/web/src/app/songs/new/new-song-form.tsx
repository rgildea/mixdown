"use client";

import { useActionState } from "react";
import { createSong, type NewSongState } from "./actions";

export function NewSongForm() {
  const [state, action, pending] = useActionState<NewSongState, FormData>(createSong, {});

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={state.title}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="client_name" className="text-sm font-medium">
          Client / artist <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="client_name"
          name="client_name"
          maxLength={200}
          defaultValue={state.clientName}
          className="rounded-md border border-zinc-300 px-3 py-2"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create song"}
      </button>
    </form>
  );
}
