import type { Metadata } from "next";
import { SHARE_TOKEN } from "@/lib/share-token";
import { OpenButton } from "./open-button";

// Link previews should say nothing about the song (the page doesn't know it until redeemed anyway).
export const metadata: Metadata = { title: "A mix has been shared with you · Mixdown", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-lg font-semibold tracking-tight">Mixdown</p>
      {children}
    </main>
  );
}

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  if (!SHARE_TOKEN.test(token)) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="text-zinc-600">Check that you copied the whole link, or ask for a new one.</p>
      </Shell>
    );
  }

  // No side effects on load, for anyone: link previews and cross-site requests can't sign anyone in
  // or redeem anything. Visitors click Listen (returning clients can bookmark /listen/... instead).
  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">A mix has been shared with you</h1>
      <p className="text-zinc-600">No account needed. Listen in your browser.</p>
      <OpenButton token={token} />
    </Shell>
  );
}
