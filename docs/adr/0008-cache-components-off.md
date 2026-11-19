# 0008. Cache Components off

- Status: Accepted
- Date: 2026-11-19
- Decided by: Ryan (reviewed)

## Context
create-next-app 16.4 enables `cacheComponents` (Partial Prerendering): each page is a static
shell plus request-time "holes", and any read of cookies, headers, `searchParams` or uncached
data outside `<Suspense>` fails the build. We hit this on `/login` and `/songs` in issue #4.

Nearly every Mixdown page is request-specific: workspace data, signed R2 URLs, and client share
pages, which sign the visitor in anonymously (ADR 0005). Only `/` and `/login` are mostly static.

## Decision
Turn off `cacheComponents` (and `partialPrefetching`, which depends on it). Write pages the
conventional way: `await getCurrentUser()` / data at the top of the page or layout.

- Still use `<Suspense>` and `loading.tsx` where streaming genuinely helps (e.g. a slow comments panel).
- Pages without request data are still prerendered statically.
- **Unchanged rule:** layouts don't protect pages. Every page that reads data calls
  `getCurrentUser()` and/or relies on RLS.

## Alternatives considered
- **Keep it on:** instant static chrome on navigation (~100–300 ms perceived) and alignment with
  Next's direction, but a Suspense boundary and fallback for every request-dependent read, "soft"
  redirects after a 200, and friction with AI tools trained on Next 13–15 patterns.
- **Per-route opt-out (`export const instant = false`):** keeps the flag but sprinkles exceptions on
  almost every route, which is the worst of both.

## Consequences
- Simpler pages; auth redirects are always real HTTP redirects.
- Lose the prerendered shell on authenticated pages (small, given Supabase and audio dominate latency).
- **Revisit if** Next.js makes Cache Components mandatory, or a page has a large static portion.
  Re-enabling is mechanical: the build names each route needing a boundary (see
  `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`).
