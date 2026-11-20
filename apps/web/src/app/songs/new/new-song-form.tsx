"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTR, checkUpload, formatBytes } from "@/lib/upload-rules";
import { createSong, createUploadUrl, finishUpload } from "./actions";

type Phase =
  | { name: "idle" }
  | { name: "saving" }
  | { name: "uploading"; loaded: number; total: number }
  | { name: "finishing" }
  | { name: "error"; message: string; canRetryUpload: boolean };

/** PUT the file straight to storage with XHR (fetch can't report upload progress). */
function putWithProgress(url: string, file: File, contentType: string, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(file);
  });
}

export function NewSongForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  // Kept after the song is created so "Try again" re-uploads instead of creating a second song.
  const [songId, setSongId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const busy = phase.name === "saving" || phase.name === "uploading" || phase.name === "finishing";

  // Warn before leaving mid-upload.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function upload(id: string, f: File) {
    const target = await createUploadUrl({ songId: id, filename: f.name, size: f.size });
    if (!target.ok) return setPhase({ name: "error", message: target.error, canRetryUpload: true });

    setPhase({ name: "uploading", loaded: 0, total: f.size });
    try {
      await putWithProgress(target.url, f, target.contentType, (loaded) =>
        setPhase({ name: "uploading", loaded, total: f.size }),
      );
    } catch (e) {
      console.warn("upload failed", e);
      return setPhase({ name: "error", message: "The upload failed. Check your connection.", canRetryUpload: true });
    }

    setPhase({ name: "finishing" });
    const done = await finishUpload({ songId: id, key: target.key, filename: f.name, size: f.size });
    if (!done.ok) return setPhase({ name: "error", message: done.error, canRetryUpload: true });
    router.push("/songs");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const picked = form.get("file");
    const f = picked instanceof File && picked.size > 0 ? picked : null;
    if (f) {
      const check = checkUpload(f);
      if (!check.ok) return setFileError(check.error);
    }
    setFile(f);

    setPhase({ name: "saving" });
    const created = await createSong({
      title: String(form.get("title") ?? ""),
      clientName: String(form.get("client_name") ?? ""),
    });
    if (!created.ok) return setPhase({ name: "error", message: created.error, canRetryUpload: false });
    setSongId(created.songId);

    if (!f) return router.push("/songs");
    await upload(created.songId, f);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <fieldset disabled={busy || songId !== null} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input id="title" name="title" required maxLength={200} className="rounded-md border border-zinc-300 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="client_name" className="text-sm font-medium">
            Client / artist <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input id="client_name" name="client_name" maxLength={200} className="rounded-md border border-zinc-300 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium">
            Mix <span className="font-normal text-zinc-500">(WAV or MP3, up to 500 MB)</span>
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept={ACCEPT_ATTR}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              const check = f ? checkUpload(f) : null;
              setFileError(check && !check.ok ? check.error : null);
            }}
            className="text-sm"
          />
          {fileError && (
            <p className="text-sm text-red-700" role="alert">
              {fileError}
            </p>
          )}
        </div>
      </fieldset>

      {phase.name === "uploading" && (
        <div className="flex flex-col gap-1">
          <progress
            aria-label="Upload progress"
            value={phase.loaded}
            max={phase.total}
            className="h-2 w-full overflow-hidden rounded [&::-webkit-progress-bar]:bg-zinc-200 [&::-webkit-progress-value]:bg-zinc-900"
          />
          <p className="text-sm text-zinc-600">
            Uploading… {formatBytes(phase.loaded)} of {formatBytes(phase.total)} (
            {Math.floor((phase.loaded / phase.total) * 100)}%)
          </p>
        </div>
      )}
      {phase.name === "finishing" && <p className="text-sm text-zinc-600">Finishing…</p>}

      {phase.name === "error" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-700" role="alert">
            {phase.message}
          </p>
          {phase.canRetryUpload && songId && file && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => upload(songId, file)}
                className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
              >
                Try again
              </button>
              <button type="button" onClick={() => router.push("/songs")} className="text-sm underline">
                Skip for now
              </button>
            </div>
          )}
        </div>
      )}

      {songId === null && (
        <button
          type="submit"
          disabled={busy || fileError !== null}
          className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {phase.name === "saving" ? "Creating…" : "Create song"}
        </button>
      )}
    </form>
  );
}
