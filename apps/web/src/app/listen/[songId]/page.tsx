import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { presignPlayback } from "@/lib/r2";
import { formatBytes } from "@/lib/upload-rules";

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
    .select("id, title, client_name, mix_versions (version_number, object_key, original_filename, size_bytes)")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  if (!song) notFound();

  const mix = song.mix_versions.toSorted((a, b) => b.version_number - a.version_number)[0] ?? null;
  const audioUrl = mix ? await presignPlayback(mix.object_key) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <p className="text-sm font-semibold tracking-tight text-zinc-500">Mixdown</p>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
        {song.client_name && <p className="text-sm text-zinc-500">{song.client_name}</p>}
      </div>
      {mix && audioUrl ? (
        <section aria-label="Mix" className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="truncate font-medium">{mix.original_filename}</p>
            <p className="shrink-0 text-sm text-zinc-500">
              v{mix.version_number} · {formatBytes(mix.size_bytes)}
            </p>
          </div>
          <audio controls preload="metadata" src={audioUrl} className="w-full" aria-label={`Play ${mix.original_filename}`}>
            Your browser can&apos;t play this file.
          </audio>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-zinc-600">
          No mix has been uploaded for this song yet.
        </p>
      )}
    </main>
  );
}
