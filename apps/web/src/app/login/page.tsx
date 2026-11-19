import { LoginForm } from "./login-form";

const LINK_ERROR = "That sign-in link is invalid or has expired. Request a new one.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Mixdown</h1>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {LINK_ERROR}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </main>
  );
}
