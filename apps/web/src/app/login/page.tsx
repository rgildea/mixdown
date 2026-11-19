import { Suspense } from "react";
import { LoginForm } from "./login-form";

const LINK_ERROR = "That sign-in link is invalid or has expired. Request a new one.";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Mixdown</h1>
      <Suspense fallback={<LoginForm />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return (
    <>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {LINK_ERROR}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
