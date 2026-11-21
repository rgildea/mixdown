import { MixReview } from "@/components/mix-review";
import type { CommentRow } from "@/lib/comment-rules";
import { formatBytes } from "@/lib/upload-rules";
import { formatDuration } from "@/lib/waveform-rules";

type Mix = {
  id: string;
  version_number: number;
  original_filename: string;
  size_bytes: number;
  duration_ms: number | null;
  peaks: number[] | null;
};

/**
 * The mix on the engineer's song page and the client's listen page: name, version, length, the waveform
 * player, and its timestamped comments (#46).
 */
export function MixCard({
  songId,
  mix,
  audioUrl,
  comments,
  defaultName,
  postVariant,
}: {
  songId: string;
  mix: Mix;
  audioUrl: string;
  comments: CommentRow[];
  defaultName: string;
  postVariant: "primary" | "secondary";
}) {
  return (
    <MixReview
      header={
        <div className="flex items-baseline justify-between gap-4">
          <p className="truncate font-medium">{mix.original_filename}</p>
          <p className="shrink-0 text-sm text-subtle">
            v{mix.version_number}
            {mix.duration_ms !== null && ` · ${formatDuration(mix.duration_ms)}`} · {formatBytes(mix.size_bytes)}
          </p>
        </div>
      }
      songId={songId}
      mix={mix}
      audioUrl={audioUrl}
      comments={comments}
      defaultName={defaultName}
      postVariant={postVariant}
    />
  );
}
