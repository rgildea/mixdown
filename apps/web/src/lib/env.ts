function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}. See apps/web/.env.example.`);
  return value;
}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them in the browser bundle.
export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};
