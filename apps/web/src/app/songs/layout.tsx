import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

// Shows the user and redirects signed-out visitors. NOTE: layouts don't protect pages
// (they render in parallel and don't re-run on client navigation). Every page that reads
// data must call getCurrentUser() itself and/or rely on RLS.
export default async function SongsLayout({ children }: LayoutProps<"/songs">) {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <Link href="/songs" className="text-lg font-semibold tracking-tight">
          Mixdown
        </Link>
        <div className="flex items-center gap-4 text-sm text-zinc-600">
          <span>{user.email}</span>
          <form action={signOut}>
            <button type="submit" className="underline underline-offset-4 hover:text-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
