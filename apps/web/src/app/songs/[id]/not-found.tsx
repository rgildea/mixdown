import Link from "next/link";

export default function SongNotFound() {
  return (
    <main className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Song not found</h1>
      <p className="text-zinc-600">It may have been deleted, or it belongs to another studio.</p>
      <Link href="/songs" className="w-fit text-sm underline underline-offset-4">
        Back to songs
      </Link>
    </main>
  );
}
