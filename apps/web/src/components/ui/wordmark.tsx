import Link from "next/link";

/** The Mixdown name as the product mark. Pass href to make it a link. */
export function Wordmark({ href }: { href?: string }) {
  const className = "text-lg font-semibold tracking-tight";
  return href ? (
    <Link href={href} className={className}>
      Mixdown
    </Link>
  ) : (
    <p className={className}>Mixdown</p>
  );
}
