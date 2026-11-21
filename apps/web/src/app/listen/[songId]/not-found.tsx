import { Wordmark } from "@/components/ui";

export default function ListenNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark />
      <h1 className="text-title font-semibold">This mix isn&apos;t available</h1>
      <p className="text-muted">
        The link may have been revoked. Open the share link you were sent again, or ask for a new one.
      </p>
    </main>
  );
}
