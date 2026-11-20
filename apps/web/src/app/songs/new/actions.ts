"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export type NewSongState = { error?: string; title?: string; clientName?: string };

export async function createSong(_prev: NewSongState, formData: FormData): Promise<NewSongState> {
  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("client_name") ?? "").trim();

  if (title.length < 1 || title.length > 200) {
    return { error: "Title must be 1–200 characters.", title, clientName };
  }
  if (clientName.length > 200) {
    return { error: "Client name must be 200 characters or fewer.", title, clientName };
  }

  // Authorizes itself (Server Actions are public endpoints); RLS enforces membership again.
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("songs")
    .insert({ workspace_id: workspace.id, title, client_name: clientName || null });

  if (error) {
    console.error("createSong:", error.code, error.message);
    return { error: "Couldn't create the song. Try again.", title, clientName };
  }

  // Upload (#6) will continue here instead; for now go back to the list.
  redirect("/songs");
}
