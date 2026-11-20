import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { LocalDate } from "@/components/local-date";
import { formatBytes } from "@/lib/upload-rules";

export default async function SongsPage() {
  // Pages check auth themselves; the layout's check doesn't protect them.
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();
  const { data: songs, error } = await supabase
    .from("songs")
    .select("id, title, client_name, created_at, mix_versions (original_filename, size_bytes)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
        <Link href="/songs/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">
          New song
        </Link>
      </div>

      {songs.length === 0 ? (
        <p className="text-zinc-600">No songs yet. Create one to upload your first mix.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200" aria-label="Songs">
          {songs.map((song) => (
            <li key={song.id} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
                <Link href={`/songs/${song.id}`} className="block truncate font-medium hover:underline">
                  {song.title}
                </Link>
                {song.client_name && <p className="truncate text-sm text-zinc-500">{song.client_name}</p>}
                <p className="truncate text-xs text-zinc-400">
                  {song.mix_versions[0]
                    ? `${song.mix_versions[0].original_filename} · ${formatBytes(song.mix_versions[0].size_bytes)}`
                    : "No mix yet"}
                </p>
              </div>
              <span className="shrink-0 text-sm text-zinc-500">
                <LocalDate iso={song.created_at} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
