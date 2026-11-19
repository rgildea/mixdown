import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

export default function SongsLayout({ children }: LayoutProps<"/songs">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <Link href="/songs" className="text-lg font-semibold tracking-tight">
          Mixdown
        </Link>
        <Suspense fallback={<span className="h-5 w-40 rounded bg-zinc-100" />}>
          <UserMenu />
        </Suspense>
      </header>
      <Suspense fallback={<p className="text-zinc-400">Loading…</p>}>{children}</Suspense>
    </div>
  );
}

// Authoritative auth check for every /songs route (the proxy redirect is only optimistic).
async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-4 text-sm text-zinc-600">
      <span>{user.email}</span>
      <form action={signOut}>
        <button type="submit" className="underline underline-offset-4 hover:text-zinc-900">
          Sign out
        </button>
      </form>
    </div>
  );
}
