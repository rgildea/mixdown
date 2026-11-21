"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  label: string;
  /** Stored at upload (ADR 0010). Without both, this is the plain audio player. */
  peaks: number[] | null;
  durationMs: number | null;
};

/** CSS custom properties from globals.css, resolved for the canvas (which can't read var()). */
function token(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/**
 * The mix player: a waveform drawn from stored peaks over the native audio element. wavesurfer.js
 * plays through that element, so audio still streams from the signed URL with range requests and the
 * file is never downloaded or decoded up front. The native controls stay for keyboard and screen readers.
 */
export function WaveformPlayer({ src, label, peaks, durationMs }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const hasWaveform = peaks !== null && peaks.length > 0 && durationMs !== null;

  useEffect(() => {
    const audio = audioRef.current;
    const container = waveRef.current;
    if (!hasWaveform || !audio || !container) return;
    let destroyed = false;
    let ws: { destroy(): void } | null = null;

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (destroyed) return;
      const w = WaveSurfer.create({
        container,
        media: audio,
        peaks: [peaks],
        duration: durationMs / 1000,
        height: 72,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        waveColor: token(container, "--line-strong"),
        progressColor: token(container, "--primary"),
        cursorColor: token(container, "--primary"),
        cursorWidth: 1,
        dragToSeek: true,
      });
      w.on("ready", () => !destroyed && setReady(true));
      ws = w;
    });

    return () => {
      destroyed = true;
      ws?.destroy();
    };
  }, [hasWaveform, peaks, durationMs]);

  return (
    <div className="flex flex-col gap-3">
      {hasWaveform && (
        // Decorative for assistive tech: seeking is also available on the native controls below.
        <div
          ref={waveRef}
          data-testid="waveform"
          data-ready={ready || undefined}
          aria-hidden="true"
          className="h-[72px] w-full cursor-pointer"
        />
      )}
      <audio ref={audioRef} controls preload="metadata" src={src} className="w-full" aria-label={label}>
        Your browser can&apos;t play this file.
      </audio>
    </div>
  );
}
