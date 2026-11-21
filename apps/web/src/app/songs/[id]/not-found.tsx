import { ButtonLink, PageHeader } from "@/components/ui";

export default function SongNotFound() {
  return (
    <main className="flex flex-col gap-3">
      <PageHeader title="Song not found" />
      <p className="text-muted">It may have been deleted, or it belongs to another studio.</p>
      <ButtonLink href="/songs" variant="link" className="w-fit">
        Back to songs
      </ButtonLink>
    </main>
  );
}
