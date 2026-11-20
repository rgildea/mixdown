"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTR, checkUpload, formatBytes } from "@/lib/upload-rules";
import { createSong, createUploadUrl, finishUpload } from "./actions";

type Phase =
  | { name: "idle" }
  | { name: "saving" }
  | { name: "uploading"; loaded: number; total: number }
  | { name: "finishing" }
  | { name: "error"; message: string; retryable: boolean };

type Failure = { ok: false; error: string; retryable: boolean };

/** Server Actions can throw (network drop, server error) as well as return errors. */
async function call<T extends { ok: boolean }>(action: () => Promise<T>): Promise<T | Failure> {
  try {
    return await action();
  } catch (e) {
    console.warn("server action failed", e);
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again.", retryable: true };
  }
}

/** PUT the file straight to storage with XHR (fetch can't report upload progress). */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number) => void,
  onXhr: (xhr: XMLHttpRequest) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhr(xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network error"));
    xhr.onabort = () => reject(new Error("aborted"));
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
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);

  const busy = phase.name === "saving" || phase.name === "uploading" || phase.name === "finishing";

  // Warn before closing/reloading mid-upload.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // In-app navigation away (e.g. the "Songs" link) cancels the upload; the song keeps no mix.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      xhrRef.current?.abort();
    };
  }, []);

  const fail = (f: Failure) => mounted.current && setPhase({ name: "error", message: f.error, retryable: f.retryable });

  async function upload(id: string, f: File) {
    const target = await call(() => createUploadUrl({ songId: id, filename: f.name, size: f.size }));
    if (!target.ok) return fail(target);

    setPhase({ name: "uploading", loaded: 0, total: f.size });
    try {
      await putWithProgress(
        target.url,
        f,
        target.contentType,
        (loaded) => mounted.current && setPhase({ name: "uploading", loaded, total: f.size }),
        (xhr) => (xhrRef.current = xhr),
      );
    } catch (e) {
      if (!mounted.current) return; // navigated away: aborted on purpose
      console.warn("upload failed", e);
      return fail({ ok: false, error: "The upload failed. Check your connection.", retryable: true });
    } finally {
      xhrRef.current = null;
    }

    setPhase({ name: "finishing" });
    const done = await call(() => finishUpload({ songId: id, key: target.key, filename: f.name, size: f.size }));
    if (!done.ok) return fail(done);
    if (mounted.current) router.push(`/songs/${id}`);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (songId && file) return upload(songId, file); // song exists: just (re)upload
    const form = new FormData(e.currentTarget);
    const input = form.get("file");
    const f = input instanceof File && input.size > 0 ? input : null;
    if (!f) return setFileError("Choose a WAV or MP3 to upload.");
    const check = checkUpload(f);
    if (!check.ok) return setFileError(check.error);
    setFile(f);

    setPhase({ name: "saving" });
    const created = await call(() =>
      createSong({ title: String(form.get("title") ?? ""), clientName: String(form.get("client_name") ?? "") }),
    );
    if (!created.ok) return fail(created);
    setSongId(created.songId);

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
      </fieldset>
      <fieldset disabled={busy} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium">
            Mix
          </label>
          <div
            className={`flex flex-col gap-2 rounded-lg border-2 border-dashed p-4 ${
              fileError ? "border-red-300 bg-red-50" : picked ? "border-zinc-400 bg-zinc-50" : "border-zinc-300"
            }`}
          >
            <input
              id="file"
              name="file"
              type="file"
              required
              accept={ACCEPT_ATTR}
              aria-describedby="file-hint"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0] ?? null;
                const check = f ? checkUpload(f) : null;
                setFileError(check && !check.ok ? check.error : null);
                setPicked(f && check?.ok ? { name: f.name, size: f.size } : null);
                if (f && check?.ok) setFile(f); // after an error, a newly picked file is what "Try again" uploads
              }}
              className="text-sm text-zinc-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
            />
            <p id="file-hint" className="text-xs text-zinc-500">
              {picked ? `Ready to upload: ${picked.name} (${formatBytes(picked.size)})` : "WAV or MP3, up to 500 MB"}
            </p>
          </div>
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
          {songId && (
            <div className="flex items-center gap-3">
              {phase.retryable && file && (
                <button
                  type="button"
                  onClick={() => upload(songId, file)}
                  className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
                >
                  Try again
                </button>
              )}
              <button type="button" onClick={() => router.push("/songs")} className="text-sm underline">
                {phase.retryable ? "Skip for now" : "Back to songs"}
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
          {phase.name === "saving" ? "Creating…" : "Create song and upload"}
        </button>
      )}
    </form>
  );
}
