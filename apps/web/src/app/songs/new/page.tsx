import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { NewSongForm } from "./new-song-form";

export default async function NewSongPage() {
  await getCurrentUser();
  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/songs" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Songs
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New song</h1>
      </div>
      <NewSongForm />
    </main>
  );
}
