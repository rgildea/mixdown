"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cx } from "@/components/ui";
import { formatTimecode } from "@/lib/comment-rules";

export type Marker = { id: string; atMs: number; label: string };

type Props = {
  src: string;
  label: string;
  /** Stored at upload (ADR 0010). Without both, this is the plain audio player (no pins either). */
  peaks: number[] | null;
  durationMs: number | null;
  /** The audio element, owned by the parent so it can read the playhead and seek. */
  audioRef: RefObject<HTMLAudioElement | null>;
  /** Saved comments with a timestamp: solid pins on the rail. */
  markers?: Marker[];
  /** The draft comment's timestamp: a hollow pin on the rail and a dashed line through the bars. */
  draftMs?: number | null;
  draftHighlighted?: boolean;
  activeMarkerId?: string | null;
  onMarkerClick?: (id: string) => void;
};

/** CSS custom properties from globals.css, resolved for the canvas (which can't read var()). */
function token(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

const pct = (ms: number, durationMs: number) => `${Math.min(100, Math.max(0, (ms / durationMs) * 100))}%`;

/** A comment pin: 10×14, flat top, pointed bottom. Hollow for the unsaved draft. */
function Pin({ hollow, active }: { hollow?: boolean; active?: boolean }) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" className="block">
      <path
        d={hollow ? "M2 .75h6c.7 0 1.25.55 1.25 1.25v7.6L5 13.05.75 9.6V2c0-.7.55-1.25 1.25-1.25Z" : "M2 0h6a2 2 0 0 1 2 2v8l-5 4-5-4V2a2 2 0 0 1 2-2Z"}
        className={cx(
          hollow ? "fill-surface-sunken stroke-[1.5]" : "",
          hollow && (active ? "stroke-foreground" : "stroke-marker"),
          !hollow && (active ? "fill-foreground" : "fill-marker"),
        )}
      />
    </svg>
  );
}

/**
 * The mix player: a waveform drawn from stored peaks over the native audio element. wavesurfer.js
 * plays through that element, so audio still streams from the signed URL with range requests and the
 * file is never downloaded or decoded up front. The native controls stay for keyboard and screen readers.
 *
 * Clicking the waveform only seeks; playback starts only from the play button. Three marks never
 * collide: comment pins sit on a rail above the well; the draft's dashed line sits under the playhead,
 * which we draw ourselves (wavesurfer's own cursor is off) so the layering is ours.
 */
export function WaveformPlayer({
  src,
  label,
  peaks,
  durationMs,
  audioRef,
  markers = [],
  draftMs = null,
  draftHighlighted = false,
  activeMarkerId = null,
  onMarkerClick,
}: Props) {
  const waveRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const hasWaveform = peaks !== null && peaks.length > 0 && durationMs !== null;

  useEffect(() => {
    const audio = audioRef.current;
    const container = waveRef.current;
    if (!hasWaveform || !audio || !container) return;
    let destroyed = false;
    let ws: { destroy(): void } | null = null;

    const movePlayhead = (seconds: number) => {
      if (playheadRef.current) playheadRef.current.style.left = pct(seconds * 1000, durationMs);
    };
    const onMediaTime = () => movePlayhead(audio.currentTime);
    // Seeks while paused don't always produce a wavesurfer timeupdate; the media events cover them.
    audio.addEventListener("seeking", onMediaTime);
    audio.addEventListener("timeupdate", onMediaTime);

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (destroyed) return;
      const w = WaveSurfer.create({
        container,
        media: audio,
        peaks: [peaks],
        duration: durationMs / 1000,
        height: 80,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        // Flat bars: played in the text colour, unplayed recessed; amber is only the playhead.
        waveColor: token(container, "--waveform-rest"),
        progressColor: token(container, "--waveform-played"),
        cursorWidth: 0,
        dragToSeek: true,
      });
      w.on("ready", () => !destroyed && setReady(true));
      w.on("timeupdate", movePlayhead); // every frame while playing
      ws = w;
    });

    return () => {
      destroyed = true;
      audio.removeEventListener("seeking", onMediaTime);
      audio.removeEventListener("timeupdate", onMediaTime);
      ws?.destroy();
    };
  }, [hasWaveform, peaks, durationMs, audioRef]);

  // The draft's timecode sits beside its pin, flipped to the left near the end so it stays in view.
  const draftFlip = hasWaveform && draftMs !== null && draftMs / durationMs > 0.85;

  return (
    <div className="flex flex-col gap-3">
      {hasWaveform && (
        <div className="flex flex-col gap-1.5">
          {/* The comment rail. Pins are mouse shortcuts; the comment list below has the same actions for keyboards. */}
          <div className="relative h-3.5" data-testid="comment-rail">
            {markers.map((m) => (
              <button
                key={m.id}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                title={`${formatTimecode(m.atMs)} · ${m.label}`}
                data-testid="comment-pin"
                data-at-ms={m.atMs}
                onClick={() => onMarkerClick?.(m.id)}
                className={cx(
                  "absolute top-0 -ml-[5px] cursor-pointer transition-transform duration-[120ms] hover:-translate-y-0.5",
                  m.id === activeMarkerId && "-translate-y-0.5",
                )}
                style={{ left: pct(m.atMs, durationMs) }}
              >
                <Pin active={m.id === activeMarkerId} />
              </button>
            ))}
            {draftMs !== null && (
              <div
                data-testid="draft-pin"
                data-at-ms={draftMs}
                aria-hidden="true"
                className={cx(
                  "pointer-events-none absolute top-0 -ml-[5px] flex items-start gap-1.5 transition-transform duration-[120ms]",
                  draftFlip && "flex-row-reverse",
                  draftHighlighted && "-translate-y-0.5",
                )}
                // Flipped: the pin stays on the time, the label grows to its left.
                style={draftFlip ? { right: `calc(100% - ${pct(draftMs, durationMs)} - 5px)` } : { left: pct(draftMs, durationMs) }}
              >
                <Pin hollow active={draftHighlighted} />
                <span className="-mt-px font-mono text-xs font-medium leading-4 text-accent-text">{formatTimecode(draftMs)}</span>
              </div>
            )}
          </div>

          <div className="relative">
            {/* Decorative for assistive tech: seeking is also available on the native controls below. */}
            <div
              ref={waveRef}
              data-testid="waveform"
              data-ready={ready || undefined}
              aria-hidden="true"
              className="box-content h-20 w-full cursor-pointer rounded-control bg-surface-sunken py-2"
            />
            {draftMs !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-foreground"
                style={{ left: pct(draftMs, durationMs) }}
              />
            )}
            {/* Over the draft line but only across the bars (inset-y-2): on the same time, the dashes still show
                in the well's top and bottom padding. */}
            <div
              ref={playheadRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2 z-20 -ml-px w-0.5 bg-playhead"
              style={{ left: "0%" }}
            />
          </div>
        </div>
      )}
      <audio ref={audioRef} controls preload="metadata" src={src} className="w-full" aria-label={label}>
        Your browser can&apos;t play this file.
      </audio>
    </div>
  );
}
