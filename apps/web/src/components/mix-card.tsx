import { Card } from "@/components/ui";
import { WaveformPlayer } from "@/components/waveform-player";
import { formatBytes } from "@/lib/upload-rules";
import { formatDuration } from "@/lib/waveform-rules";

type Mix = {
  version_number: number;
  original_filename: string;
  size_bytes: number;
  duration_ms: number | null;
  peaks: number[] | null;
};

/** The mix on the engineer's song page and the client's listen page: name, version, length, waveform player. */
export function MixCard({ mix, audioUrl }: { mix: Mix; audioUrl: string }) {
  return (
    <Card aria-label="Mix">
      <div className="flex items-baseline justify-between gap-4">
        <p className="truncate font-medium">{mix.original_filename}</p>
        <p className="shrink-0 text-sm text-subtle">
          v{mix.version_number}
          {mix.duration_ms !== null && ` · ${formatDuration(mix.duration_ms)}`} · {formatBytes(mix.size_bytes)}
        </p>
      </div>
      <WaveformPlayer
        src={audioUrl}
        label={`Play ${mix.original_filename}`}
        peaks={mix.peaks}
        durationMs={mix.duration_ms}
      />
    </Card>
  );
}
