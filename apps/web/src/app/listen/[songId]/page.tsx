import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { presignPlayback } from "@/lib/r2";
import { MixCard } from "@/components/mix-card";
import { displayName, getComments } from "@/lib/comments";
import { EmptyState, Wordmark } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The client's view of a shared song (ADR 0005). Access comes only from RLS: a studio member, or a
// client whose grant's link is still active. Revoked/expired/never-granted all look the same (404).
export default async function ListenPage({ params }: PageProps<"/listen/[songId]">) {
  const { songId } = await params;
  if (!UUID.test(songId)) notFound();
  const user = await getSessionUser();
  if (!user) notFound();

  const supabase = await createClient();
  const { data: song, error } = await supabase
    .from("songs")
    .select("id, title, client_name, mix_versions (id, version_number, object_key, original_filename, size_bytes, duration_ms, peaks)")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  if (!song) notFound();

  const mix = song.mix_versions.toSorted((a, b) => b.version_number - a.version_number)[0] ?? null;
  const audioUrl = mix ? await presignPlayback(mix.object_key) : null;
  const comments = mix ? await getComments(mix.id) : [];

  return (
    <main className="mx-auto flex w-full max-w-shell flex-col gap-6 px-6 py-10">
      <Wordmark />
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold">{song.title}</h1>
        {song.client_name && <p className="text-sm text-subtle">{song.client_name}</p>}
      </div>
      {mix && audioUrl ? (
        <MixCard
          songId={song.id}
          mix={mix}
          audioUrl={audioUrl}
          comments={comments}
          defaultName={displayName(user)}
          postVariant="primary"
        />
      ) : (
        <EmptyState aria-label="Mix" title="No mix has been uploaded for this song yet." />
      )}
    </main>
  );
}
