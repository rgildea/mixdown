import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { presignPlayback } from "@/lib/r2";
import { formatBytes } from "@/lib/upload-rules";
import { LocalDate } from "@/components/local-date";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SongPage({ params }: PageProps<"/songs/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Pages authorize themselves. The song is read through RLS: another workspace's song simply
  // isn't found, which is indistinguishable from a missing one (no existence leak).
  await getCurrentWorkspace();
  const supabase = await createClient();
  const { data: song, error } = await supabase
    .from("songs")
    .select("id, title, client_name, created_at, mix_versions (version_number, object_key, original_filename, size_bytes, mime_type)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!song) notFound();

  const mix = song.mix_versions.find((v) => v.version_number === 1) ?? null;
  // A fresh 1-hour signed URL on every request (ADR 0003): refreshing the page restores playback.
  const audioUrl = mix ? await presignPlayback(mix.object_key) : null;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/songs" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Songs
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
        <p className="text-sm text-zinc-500">
          {song.client_name ? `${song.client_name} · ` : ""}
          Created <LocalDate iso={song.created_at} />
        </p>
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
        <section aria-label="Mix" className="rounded-lg border border-dashed border-zinc-300 p-6 text-center">
          <p className="font-medium">No mix uploaded</p>
          <p className="text-sm text-zinc-500">The upload for this song didn&apos;t finish.</p>
        </section>
      )}
    </main>
  );
}
