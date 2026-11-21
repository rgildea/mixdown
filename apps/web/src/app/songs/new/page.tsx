import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { NewSongForm } from "./new-song-form";

export default async function NewSongPage() {
  await getCurrentUser();
  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="New song" back={{ href: "/songs", label: "Songs" }} />
      <NewSongForm />
    </main>
  );
}
