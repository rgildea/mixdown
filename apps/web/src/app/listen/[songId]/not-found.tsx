export default function ListenNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold tracking-tight">Mixdown</p>
      <h1 className="text-2xl font-semibold tracking-tight">This mix isn&apos;t available</h1>
      <p className="text-zinc-600">
        The link may have been revoked. Open the share link you were sent again, or ask for a new one.
      </p>
    </main>
  );
}
