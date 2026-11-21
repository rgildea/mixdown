import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";

const LINK_ERROR = "That sign-in link is invalid or has expired. Request a new one.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-title font-semibold">Sign in to Mixdown</h1>
      {error && <Alert tone="danger">{LINK_ERROR}</Alert>}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </main>
  );
}
