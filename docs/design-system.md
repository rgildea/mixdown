# Design system

Mixdown's look is quiet on purpose: near-black on white, one accent (the primary button), Geist type. The
audio is the content. This page lists the tokens and components that the UI is built from, for people,
AI tools and design imports (Claude Design, `/design-sync`).

**Rule:** pages use semantic tokens and `src/components/ui/`, never raw palette shades (`zinc-500`,
`red-700`…) or one-off button styles. A new style need usually means a new token or a component prop.

## Tokens (`apps/web/src/app/globals.css`)

Defined on `:root` and exposed to Tailwind v4 through `@theme`, so each one is a utility
(`bg-primary`, `text-subtle`, `border-line`, `rounded-card`…).

### Color

| Token | Utility examples | Value (Tailwind shade) | Use |
| --- | --- | --- | --- |
| `background` | `bg-background` | white | Page background |
| `foreground` | `text-foreground` | #171717 | Body text, headings, link hover |
| `surface` | `bg-surface` | zinc-50 | Read-only fields, a picked file |
| `muted` | `text-muted` | zinc-600 | Paragraphs under a heading, progress text |
| `subtle` | `text-subtle` | zinc-500 | Meta lines, hints, secondary list text |
| `faint` | `text-faint` | zinc-400 | Tertiary info (file under a song, error IDs) |
| `line` | `border-line`, `divide-line` | zinc-200 | Dividers, card borders, progress track |
| `line-strong` | `border-line-strong` | zinc-300 | Input borders, empty states, drop zone |
| `line-active` | `border-line-active` | zinc-400 | Drop zone with a file picked |
| `primary` | `bg-primary` | zinc-900 | Primary buttons, progress fill |
| `primary-hover` | `hover:bg-primary-hover` | zinc-700 | Primary button hover |
| `on-primary` | `text-on-primary` | white | Text on primary |
| `danger` | `text-danger` | red-700 | Inline errors, destructive links |
| `danger-strong` | `text-danger-strong` | red-800 | Text on `danger-surface` |
| `danger-surface` | `bg-danger-surface` | red-50 | Error alerts, drop zone with a bad file |
| `danger-line` | `border-danger-line` | red-300 | Drop zone with a bad file |
| `success` | `text-success` | emerald-900 | Text on `success-surface` |
| `success-surface` | `bg-success-surface` | emerald-50 | Success alerts |

There is no dark theme yet. When there is, it redefines the `:root` values and nothing else changes.

### Type

- **Fonts:** Geist (`font-sans`, default) and Geist Mono (`font-mono`, share links), loaded in `layout.tsx`.
- **Scale** (Tailwind defaults):
  - `text-3xl font-semibold tracking-tight`: landing title
  - `text-2xl font-semibold tracking-tight`: page title (`PageHeader`)
  - `text-lg font-semibold tracking-tight`: wordmark
  - `font-medium`: section titles and list item titles
  - `text-sm`: controls, meta and errors
  - `text-xs`: hints

### Shape and spacing

- **Radius:** `rounded-control` (0.375rem) for buttons, inputs and alerts, and `rounded-card` (0.5rem) for
  cards, drop zones and empty states.
- **Spacing:** Tailwind's 4px scale. Inside a control: `px-3 py-2` (input) or `px-4 py-2` (button).
  Between related items: `gap-1` (label → control) and `gap-3` (inside a card). Between page blocks:
  `gap-6`. App shell: `max-w-3xl px-6 py-8`.

## Components (`apps/web/src/components/ui/`, import from `@/components/ui`)

| Component | Props | Notes |
| --- | --- | --- |
| `Button` | `variant`: `primary` (default), `link`, `danger-link`. `size`: `sm` (default, text-sm), `md` (base text), `lg` (big call to action). | `type="button"` unless set. Disabled = 50% opacity. |
| `ButtonLink` | Same as `Button`, plus Next `Link` props | Navigation that looks like a button |
| `buttonClasses()` | `{ variant, size, className }` | For an element that's neither of the above |
| `Input` | `<input>` props | `readOnly` adds the `surface` background |
| `Field` | `label`, `htmlFor`, `optional`, `hint`, `hintId`, `error` | Label + control + hint + inline error |
| `ErrorText` | children | Inline error, `role="alert"` |
| `Alert` | `tone`: `danger` or `success` | Boxed page-level message (`alert` or `status` role) |
| `Card` | `<section>` props | Bordered region. Give it an `aria-label`. |
| `EmptyState` | `title`, `description`, `<section>` props | Dashed placeholder |
| `PageHeader` | `title`, `back`, `meta`, `actions` | Page title block with back link, meta line and right-side actions |
| `Wordmark` | `href` | "Mixdown" as the product mark |
| `cx()` | class names | Joins truthy class names |

Components are plain Tailwind and React, with no component library (PROJECT.md, Week 1 rule).
