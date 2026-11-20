/** Post-login destination: a path on this site, or the fallback. */
export function safeNext(next: string | null | undefined, fallback = "/songs"): string {
  return next?.startsWith("/") ? next : fallback;
}
