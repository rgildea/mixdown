"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, Card, cx, ErrorText, Input } from "@/components/ui";
import { WaveformPlayer } from "@/components/waveform-player";
import { addComment } from "@/lib/comment-actions";
import { byTimeline, formatTimecode, MAX_BODY, MAX_NAME, type CommentRow } from "@/lib/comment-rules";

type Mix = { id: string; original_filename: string; duration_ms: number | null; peaks: number[] | null };

type Props = {
  header: ReactNode;
  songId: string;
  mix: Mix;
  audioUrl: string;
  comments: CommentRow[];
  /** The name saved on this user from their last comment ("" if they've never commented). */
  defaultName: string;
  /** "primary" where commenting is the view's main action (the client's listen page). */
  postVariant: "primary" | "secondary";
};

/**
 * The player plus timestamped comments (#46). The draft's time follows these rules (Ryan, 2026-11-21):
 * - Focusing the empty composer starts a draft at the playhead (the time at that moment, even mid-playback).
 * - Playback never moves the draft's time; only a seek does (waveform, native controls, a comment's
 *   timecode), and a seek also re-adds a time the commenter had cleared.
 * - The pill's × clears the time: the comment is then on the whole mix.
 */
export function MixReview({ header, songId, mix, audioUrl, comments: initial, defaultName, postVariant }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [comments, setComments] = useState(() => initial.toSorted(byTimeline));
  const [drafting, setDrafting] = useState(false);
  const [draftAt, setDraftAt] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [name, setName] = useState(defaultName);
  const [askName] = useState(defaultName === "");
  const [pillHot, setPillHot] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = { text: useId(), name: useId(), hint: useId() };

  const playheadMs = () => Math.floor((audioRef.current?.currentTime ?? 0) * 1000);

  // Any seek while a draft is open moves the draft to the new time. Playback alone fires no "seeking".
  const draftingRef = useRef(drafting);
  useEffect(() => {
    draftingRef.current = drafting;
  }, [drafting]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onSeeking = () => draftingRef.current && setDraftAt(Math.floor(audio.currentTime * 1000));
    audio.addEventListener("seeking", onSeeking);
    return () => audio.removeEventListener("seeking", onSeeking);
  }, []);

  function startDraft() {
    if (drafting) return;
    setDrafting(true);
    setDraftAt(playheadMs());
  }

  function reset() {
    setDrafting(false);
    setDraftAt(null);
    setBody("");
    setPillHot(false);
    setError(null);
  }

  /** Moves the playhead without starting playback (only the play button plays). */
  function seek(ms: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = ms / 1000;
  }

  function select(c: CommentRow) {
    setActiveId(c.id);
    if (c.at_ms !== null) seek(c.at_ms);
  }

  function post() {
    if (pending) return;
    start(async () => {
      setError(null);
      try {
        const r = await addComment({ songId, versionId: mix.id, atMs: draftAt, body, authorName: name });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setComments((cs) => [...cs, r.comment].toSorted(byTimeline));
        setActiveId(r.comment.id);
        reset();
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });
  }

  const markers = comments.flatMap((c) =>
    c.at_ms === null ? [] : [{ id: c.id, atMs: c.at_ms, label: `${c.author_name}: ${c.body.slice(0, 80)}` }],
  );

  // Clicking a pin selects its comment in the list too.
  useEffect(() => {
    if (activeId) listRef.current?.querySelector(`[data-comment-id="${activeId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <>
      <Card aria-label="Mix">
        {header}
        <WaveformPlayer
          src={audioUrl}
          label={`Play ${mix.original_filename}`}
          peaks={mix.peaks}
          durationMs={mix.duration_ms}
          audioRef={audioRef}
          markers={markers}
          draftMs={drafting ? draftAt : null}
          draftHighlighted={pillHot}
          activeMarkerId={activeId}
          onMarkerClick={(id) => {
            const c = comments.find((x) => x.id === id);
            if (c) select(c);
          }}
        />

        <form
          aria-label="New comment"
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
        >
          {drafting && askName && (
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.name} className="text-sm font-medium">
                Your name
              </label>
              <Input
                id={ids.name}
                value={name}
                maxLength={MAX_NAME}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-xs"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 rounded-control border border-line-strong bg-surface p-3 focus-within:border-focus-ring">
            {drafting && (
              <div className="flex items-center gap-2" id={ids.hint}>
                {draftAt !== null ? (
                  // The segmented pill: time | ×. Hovering or focusing it lights up the draft pin.
                  <span
                    data-testid="draft-time"
                    className="inline-flex items-stretch rounded-marker bg-accent-surface font-mono text-xs font-medium leading-4 text-accent-text ring-1 ring-accent-line ring-inset"
                    onMouseEnter={() => setPillHot(true)}
                    onMouseLeave={() => setPillHot(false)}
                    onFocus={() => setPillHot(true)}
                    onBlur={() => setPillHot(false)}
                  >
                    <span className="px-1.5 py-0.5">
                      <span className="sr-only">Comment at </span>
                      {formatTimecode(draftAt)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove timestamp ${formatTimecode(draftAt)}`}
                      onClick={() => {
                        setDraftAt(null);
                        setPillHot(false);
                        textRef.current?.focus();
                      }}
                      className="cursor-pointer border-l border-accent-line px-1.5 hover:bg-accent-line/40"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span data-testid="draft-time" className="text-xs text-subtle">
                    On the whole mix · seek to pin it to a time
                  </span>
                )}
              </div>
            )}
            <textarea
              ref={textRef}
              id={ids.text}
              aria-label="Comment"
              aria-describedby={drafting ? ids.hint : undefined}
              rows={drafting ? 3 : 1}
              maxLength={MAX_BODY}
              placeholder="Comment at the playhead…"
              value={body}
              onFocus={startDraft}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  post();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  reset();
                  e.currentTarget.blur();
                }
              }}
              data-composer
              className="resize-y bg-transparent text-foreground placeholder:text-faint"
            />
          </div>

          {drafting && (
            <div className="flex items-center gap-3">
              <Button type="submit" variant={postVariant} disabled={pending || body.trim() === "" || name.trim() === ""}>
                {pending ? "Posting…" : "Post comment"}
              </Button>
              <Button variant="link" size="sm" onClick={reset} disabled={pending}>
                Cancel
              </Button>
              <span className="ml-auto hidden text-xs text-subtle sm:inline">⌘/Ctrl+Enter to post</span>
            </div>
          )}
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      </Card>

      <Card aria-label="Comments">
        <h2 className="text-heading font-semibold">
          Comments {comments.length > 0 && <span className="font-normal text-subtle">{comments.length}</span>}
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-subtle">No comments yet.</p>
        ) : (
          <ol ref={listRef} className="-mx-4 flex flex-col">
            {comments.map((c) => (
              <li
                key={c.id}
                data-comment-id={c.id}
                className={cx(
                  "flex flex-col gap-1 px-4 py-3 [&+&]:border-t [&+&]:border-line",
                  c.id === activeId && "bg-accent-surface",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  {c.at_ms !== null ? (
                    <button
                      type="button"
                      onClick={() => select(c)}
                      aria-label={`Seek to ${formatTimecode(c.at_ms)}`}
                      className="cursor-pointer rounded-marker bg-accent-surface px-1.5 py-px font-mono text-xs font-medium leading-4 text-accent-text hover:ring-1 hover:ring-accent-line hover:ring-inset"
                    >
                      {formatTimecode(c.at_ms)}
                    </button>
                  ) : (
                    <span className="rounded-marker bg-surface-raised px-1.5 py-px text-xs font-medium leading-4 text-subtle">
                      Whole mix
                    </span>
                  )}
                  <span className="font-medium">{c.author_name}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{c.body}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
