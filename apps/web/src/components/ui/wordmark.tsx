import Link from "next/link";

/** Four meter bars, the third lit amber: the only graphic in the mark. */
function Meter() {
  return (
    <span aria-hidden="true" className="inline-flex h-4 items-center gap-0.5">
      <i className="block h-[7px] w-[3px] rounded-marker bg-foreground" />
      <i className="block h-4 w-[3px] rounded-marker bg-foreground" />
      <i className="block h-[11px] w-[3px] rounded-marker bg-primary" />
      <i className="block h-[5px] w-[3px] rounded-marker bg-foreground" />
    </span>
  );
}

/** The Mixdown name as the product mark. Pass href to make it a link. */
export function Wordmark({ href }: { href?: string }) {
  const className = "inline-flex items-center gap-2 text-heading font-semibold text-foreground";
  return href ? (
    <Link href={href} className={className}>
      <Meter />
      Mixdown
    </Link>
  ) : (
    <p className={className}>
      <Meter />
      Mixdown
    </p>
  );
}
