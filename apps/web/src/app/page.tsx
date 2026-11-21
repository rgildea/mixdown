import { ButtonLink } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-display font-semibold">Mixdown</h1>
      <p className="text-muted">
        Hello, universe! Mix review &amp; approval portal: share a mix, get comments pinned to the exact
        moment, approve the final version.
      </p>
      <p className="text-sm text-faint">Week 1: foundation. Login, songs, upload, playback.</p>
      <ButtonLink href="/songs" variant="primary" size="lg" className="w-fit">
        Go to my songs
      </ButtonLink>
    </main>
  );
}
