import type { Metadata } from "next";
import { ButtonLink, Wordmark } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SHARE_TOKEN } from "@/lib/share-token";
import { OpenButton } from "./open-button";

// Link previews should say nothing about the song (the page doesn't know it until redeemed anyway).
export const metadata: Metadata = { title: "A mix has been shared with you · Mixdown", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark />
      {children}
    </main>
  );
}

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  if (!SHARE_TOKEN.test(token)) {
    return (
      <Shell>
        <h1 className="text-title font-semibold">This link isn&apos;t valid</h1>
        <p className="text-muted">Check that you copied the whole link, or ask for a new one.</p>
      </Shell>
    );
  }

  // No side effects on load, for anyone: link previews and cross-site requests can't sign anyone in
  // or redeem anything. Visitors click Listen (returning clients can bookmark /listen/... instead).
  // The page only READS who is visiting, to pick the copy. Previews carry no cookies: generic copy.
  const user = await getSessionUser();

  if (user && !user.is_anonymous) {
    // RLS lets studio members (and only them) read their songs' links, so a row means "your own link".
    const supabase = await createClient();
    const { data: own, error } = await supabase
      .from("share_links")
      .select("song_id, revoked_at")
      .eq("token", token)
      .maybeSingle();
    if (error) console.error("share page own-link check:", error.code, error.message);

    if (own) {
      return (
        <Shell>
          <h1 className="text-title font-semibold">This is your share link</h1>
          <p className="text-muted">
            {own.revoked_at
              ? "You revoked it, so your client now sees \"This link is no longer active\"."
              : "This is the page your client sees."}
          </p>
          {!own.revoked_at && <OpenButton token={token} label="Preview as client" />}
          <ButtonLink href={`/songs/${own.song_id}`} variant="link">
            Back to song
          </ButtonLink>
        </Shell>
      );
    }

    return (
      <Shell>
        <h1 className="text-title font-semibold">A mix has been shared with you</h1>
        <p className="text-muted">
          Signed in as <span className="font-medium text-foreground">{user.email ?? "your account"}</span>. The mix will be added to
          this account.
        </p>
        <OpenButton token={token} />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-title font-semibold">A mix has been shared with you</h1>
      <p className="text-muted">No account needed. Listen in your browser.</p>
      <OpenButton token={token} />
    </Shell>
  );
}
