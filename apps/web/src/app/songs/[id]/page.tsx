import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { presignPlayback } from "@/lib/r2";
import { formatBytes } from "@/lib/upload-rules";
import { LocalDate } from "@/components/local-date";
import { SharePanel } from "./share-panel";
import { siteUrl } from "@/lib/site-url";
import { Card, EmptyState, PageHeader } from "@/components/ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SongPage({ params }: PageProps<"/songs/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Pages authorize themselves. Scoped to the user's own workspace explicitly, not just via RLS:
  // once share links grant clients read access (ADR 0005), RLS alone would let a user who redeemed
  // another studio's link see that song here. Clients use /s/[token] instead. A foreign song is
  // simply not found, indistinguishable from a missing one (no existence leak).
  const workspace = await getCurrentWorkspace();
  const supabase = await createClient();
  const { data: song, error } = await supabase
    .from("songs")
    .select("id, title, client_name, created_at, mix_versions (version_number, object_key, original_filename, size_bytes, mime_type)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (error) throw error;
  if (!song) notFound();

  // Latest version (only v1 exists until Week 3 adds versions).
  const mix = song.mix_versions.toSorted((a, b) => b.version_number - a.version_number)[0] ?? null;
  // A fresh 1-hour signed URL on every request (ADR 0003): refreshing the page restores playback.
  const audioUrl = mix ? await presignPlayback(mix.object_key) : null;

  // The active share link, if any (readable only by studio members, via RLS).
  const { data: link } = await supabase
    .from("share_links")
    .select("token")
    .eq("song_id", song.id)
    .is("revoked_at", null)
    .maybeSingle();
  // Built from the configured site URL, not request headers: a link copied on a (login-protected)
  // Vercel preview still points at production, and no proxy header can change the domain.
  const shareUrl = link ? `${siteUrl()}/s/${link.token}` : null;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={song.title}
        back={{ href: "/songs", label: "Songs" }}
        meta={
          <>
            {song.client_name ? `${song.client_name} · ` : ""}
            Created <LocalDate iso={song.created_at} />
          </>
        }
      />

      {mix && audioUrl ? (
        <Card aria-label="Mix">
          <div className="flex items-baseline justify-between gap-4">
            <p className="truncate font-medium">{mix.original_filename}</p>
            <p className="shrink-0 text-sm text-subtle">
              v{mix.version_number} · {formatBytes(mix.size_bytes)}
            </p>
          </div>
          <audio controls preload="metadata" src={audioUrl} className="w-full" aria-label={`Play ${mix.original_filename}`}>
            Your browser can&apos;t play this file.
          </audio>
        </Card>
      ) : (
        <EmptyState
          aria-label="Mix"
          title="No mix uploaded"
          description="The upload for this song didn't finish."
        />
      )}

      <SharePanel songId={song.id} url={shareUrl} />
    </main>
  );
}
