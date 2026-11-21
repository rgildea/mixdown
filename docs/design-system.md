# Design system: Control room

Mixdown should feel like a good control room: calm, warm and studio-grade, so the music is what you
notice. Warm graphite surfaces, one amber backlight, and nothing else asking for attention. This page
is the rulebook for people, AI tools and design imports (Claude Design, `/design-sync`).

The source of truth for the look is the "Mixdown" design system in Claude Design. This page and
`apps/web/src/app/globals.css` are its implementation in the app. When they disagree, update the code
to the design system (or change the design system first), not the other way round.

**Rule:** pages use the semantic tokens below and the components in `src/components/ui/`, never raw
palette shades (`zinc-500`, `amber-400`…), hex values or one-off button styles. A new style need
usually means a new token or a component prop, added here too.

## Principles

1. **The audio is the content.** The waveform is the largest, highest-contrast thing on a song page.
   Chrome around it stays quiet: no decoration, no illustrations, no gradients.
2. **One amber.** `primary` is the meter backlight. It marks the one primary action in a view, the
   playhead and (later) comment pins. If amber is everywhere, it means nothing.
3. **Time is the shared language.** Engineers and clients talk in timecodes. Timecodes, versions,
   share links and file names are set in mono.
4. **Lines, not depth.** Surfaces separate with 1px `line` borders. The only shadow is
   `shadow-popover`, for menus that float above the page.
5. **Dark first, light equal.** Dark is the studio default; light is the same system in daylight,
   for clients reviewing at an office. Both themes pass the same contrast checks.

## Voice

Direct, warm, technical when it helps. Sentence case everywhere. Name the thing: "Approve v3", "Comment
at 01:42", "Shared by R.G.". No exclamation marks, no "successfully", no "please". Errors say what
happened, then what to do ("That's a project file. Bounce a WAV or MP3.").

## Tokens (`apps/web/src/app/globals.css`)

Colours are CSS variables on `:root` (dark) and redefined under `@media (prefers-color-scheme: light)`
(light). `@theme inline` exposes them to Tailwind v4, so each is a utility (`bg-surface`,
`text-subtle`, `border-line`, `ring-line-strong`…). A theme only ever redefines values; components never
check the theme.

### Colour

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `background` | `#141311` | `#f6f3ee` | Page background |
| `surface` | `#1b1a17` | `#ffffff` | Cards, the player, inputs, secondary buttons |
| `surface-raised` | `#24221e` | `#ffffff` | Hover rows and buttons, menus, the file picker button |
| `surface-sunken` | `#0f0e0c` | `#ede9e2` | The waveform well, read-only fields (share link) |
| `foreground` | `#ece7de` | `#1a1815` | Body text, headings |
| `muted` | `#b5aea3` | `#4f4a43` | Paragraphs under a heading, progress text, link buttons |
| `subtle` | `#9a9388` | `#655f56` | Meta lines, hints, secondary list text |
| `faint` | `#77716a` | `#8a8378` | Non-essential text only (file under a song, error IDs), placeholders |
| `line` | `#2b2925` | `#e3ded5` | Dividers, card borders, progress track |
| `line-strong` | `#3d3a34` | `#cbc4b8` | Input borders, empty states, drop zone, secondary button ring |
| `line-active` | `#6b655c` | `#8f887d` | Input and button hover, drop zone with a file picked |
| `primary` | `#e8a54b` | `#e39a3b` | The one primary action per view, progress fill |
| `primary-hover` | `#f2b867` | `#d38a2a` | Primary button hover |
| `on-primary` | `#1a1206` | `#1a1206` | Text on `primary`: near-black, never white |
| `accent-text` | `#e8a54b` | `#985910` | Amber as text (timecodes, the active version) |
| `accent-surface` | `#2a2114` | `#fbefdc` | Amber tint: a selected comment, the In review badge |
| `accent-line` | `#5c4321` | `#ecc78f` | Border of an `accent-surface` block |
| `focus-ring` | `#f2b867` | `#b86e16` | Keyboard focus (applied globally) |
| `waveform-played` | `#ece7de` | `#1a1815` | Waveform bars left of the playhead |
| `waveform-rest` | `#4a463f` | `#b3ab9e` | Waveform bars not yet played |
| `playhead` | `#e8a54b` | `#b86e16` | The playhead line |
| `marker` | `#e8a54b` | `#b86e16` | A comment's pin on the waveform rail (solid saved, hollow draft) |
| `danger` | `#f08473` | `#b3261e` | Inline errors, destructive links |
| `danger-strong` | `#f7a99c` | `#8c1d17` | Text on `danger-surface` |
| `danger-surface` | `#2c1714` | `#fbeae7` | Error alerts, drop zone with a bad file |
| `danger-line` | `#6b2e26` | `#eba79d` | Drop zone with a bad file |
| `success` | `#9fd4b3` | `#245a3c` | Text on `success-surface` |
| `success-surface` | `#15241b` | `#e6f2ea` | Success alerts (link sent, link copied) |

The design system also defines tokens for features that don't exist yet (`marker-resolved`,
`waveform-hover`, `waveform-range`, `approved`, `approved-surface`, `approved-line`). Add each to
`globals.css` with the story that first uses it, with the values from the design system.

**Colour rules**

- At most **one `primary`** (amber) button per view. Everything else is `secondary`, `ghost` or a link.
- Amber as text is `accent-text`, never `primary`: light needs a darker amber to reach 4.5:1.
- Text on `primary` is `on-primary` (near-black) in both themes.
- `faint` is for text nobody needs to read (3:1+). Anything someone must read is `subtle` or stronger.
- State never rests on colour alone: errors have words, Approved (later) carries a check.
- Contrast: body and meta text ≥ 4.5:1 on `background`, `surface` and `surface-sunken` in both themes;
  `playhead`, `line-active` and `focus-ring` ≥ 3:1. Check both themes when adding a token.

### Type

**Hanken Grotesk** (400, 500, 600) for everything (`font-sans`, the default) and **JetBrains Mono**
(400, 500) for timecodes, share links, file names and version numbers (`font-mono`). Both load with
`next/font/google` in `layout.tsx`.

| Utility | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `text-display` | 40 / 44, −0.02em | `font-semibold` | Landing title only |
| `text-title` | 28 / 34, −0.015em | `font-semibold` | Page title (`PageHeader`, share and login pages) |
| `text-heading` | 18 / 26, −0.01em | `font-semibold` | Card and section headings, the wordmark |
| `text-base` | 15 / 22 | normal or `font-medium` | Body (the default), list item titles, labels |
| `text-sm` | 13 / 18 | normal | Controls, meta lines, errors |
| `text-xs` | 12 / 16 | normal or `font-medium` | Hints, badges |
| `font-mono text-sm` | 13 / 18 | normal | Share links, file names |

`text-base`, `text-sm` and `text-xs` replace Tailwind's defaults in `@theme`, so existing utilities
follow the scale. Tracking is built into the heading sizes; don't add `tracking-tight`. Don't use
Tailwind's other sizes (`text-lg`, `text-2xl`…): add a step here first if one is really missing.

### Shape, space and size

- **Radius:** `rounded-control` (6px) for buttons, inputs, alerts and badges; `rounded-card` (10px)
  for cards, the player, drop zones and empty states; `rounded-marker` (2px) for waveform bars and
  progress tracks; `rounded-full` only for round play buttons and avatars.
- **Spacing:** Tailwind's 4px scale. `gap-1` label → control; `gap-3` inside a card; `p-4` card
  padding; `gap-6` between page blocks; app shell `px-6 py-8`.
- **Size:** `max-w-shell` (960px) for the signed-in app and the listen page, so the waveform gets room;
  narrower columns (`max-w-sm`, `max-w-md`) for single forms and centered messages. `h-control` (36px)
  for buttons and inputs, `h-control-lg` (44px) for large buttons. The waveform well is 96px tall.
- **Elevation:** none. Use `border-line`. `shadow-popover` is only for menus and popovers.

### Motion

Fast and mechanical, like a fader: 120ms colour transitions on hover and press, 200ms for progress.
No easing flourishes and no animated waveforms. Nothing moves while someone is listening except the
playhead.

### Focus

Every interactive element gets the same 2px `focus-ring` outline with a 2px offset (global rule in
`globals.css`); inputs draw it flush and turn their border amber. Never remove an outline without
replacing it.

## Components (`apps/web/src/components/ui/`, import from `@/components/ui`)

| Component | Props | Notes |
| --- | --- | --- |
| `Button` | `variant`: `secondary` (default), `primary`, `ghost`, `link`, `danger-link`. `size`: `sm` (default, 13px), `md` (15px), `lg` (44px tall, semibold). | `type="button"` unless set. Disabled = 50% opacity. |
| `ButtonLink` | Same as `Button`, plus Next `Link` props | Navigation that looks like a button |
| `buttonClasses()` | `{ variant, size, className }` | For an element that's neither of the above |
| `Input` | `<input>` props | `surface` with a `line-strong` border; `readOnly` sinks it (`surface-sunken`, `muted` text) |
| `Field` | `label`, `htmlFor`, `optional`, `hint`, `hintId`, `error` | Label + control + hint + inline error |
| `ErrorText` | children | Inline error, `role="alert"` |
| `Alert` | `tone`: `danger` or `success` | Boxed page-level message (`alert` or `status` role) |
| `Card` | `<section>` props | `surface` with a `line` border. Give it an `aria-label`. |
| `EmptyState` | `title`, `description`, `<section>` props | Dashed placeholder |
| `PageHeader` | `title`, `back`, `meta`, `actions` | Page title block; actions align to the title's baseline row |
| `Wordmark` | `href` | Four meter bars (the third amber) + "Mixdown" |
| `cx()` | class names | Joins truthy class names |

**Buttons:** pick the variant by role, not looks. `primary` is the one action the view exists for
(Create song and upload, Create share link, Listen, New song; Try again when recovering is the view's
main action). `secondary` is every other button (Copy link). `ghost` is for toolbars. `link` and `danger-link` are inline
actions (Sign out, Back to songs, Revoke). Labels are verb first, sentence case, 1–3 words.

**Waveform player** (`src/components/waveform-player.tsx`): bars sit in a `surface-sunken` well;
played bars are `waveform-played`, unplayed `waveform-rest`, the playhead is a 2px `playhead` line.
Flat bars, no gradients or glows, and don't colour bars per section or comment. wavesurfer.js draws
on a canvas, so the player reads token values with `getComputedStyle` when it mounts.

**Comment marks on the waveform** (#46). Three marks, told apart by shape rather than a new colour:
- **Playhead:** a solid 2px `playhead` line across the bars. We draw it ourselves (wavesurfer's cursor is off) so
  it layers above the draft line.
- **Saved comment:** a solid 10×14 `marker` pin on a rail above the well (never on the bars). The selected
  comment's pin turns `foreground` and lifts 2px.
- **Draft comment:** a hollow `marker` pin on the rail with its timecode beside it (mono, `accent-text`), plus a
  1px dashed `foreground` line through the whole well. On the same time as the playhead, the playhead covers the
  bars and the dashes still show in the well's padding; the hollow pin is on the rail either way. Hovering the
  composer's time pill turns the draft pin `foreground` and lifts it.

**Comment composer and list** (`src/components/mix-review.tsx`). The composer is one bordered box (focus ring on the
box, not the textarea). Focusing it starts a draft at the playhead and shows a segmented time pill (`1:23 | ×`,
mono `accent-text` on `accent-surface`, `accent-line` ring); × makes it a whole-mix comment. Only seeks move the
draft's time, never playback; clicking the waveform or a comment seeks and never starts playback. "Post comment"
is `primary` on the listen page (the view's main action) and `secondary` on the song page. ⌘/Ctrl+Enter posts, Esc
cancels. In the list, a comment's time is a seek button in the same pill style; whole-mix comments show a
`surface-raised` "Whole mix" tag and come first. The selected comment gets `accent-surface`.

Don't restyle a component by passing a conflicting utility in `className` (e.g. a second text colour):
`cx()` joins classes without merging them, so Tailwind's CSS order decides which wins. Add a variant or
prop instead; `className` is for layout (`w-fit`, margins).

Components are plain Tailwind and React, with no component library (PROJECT.md).

## Screens

- **Landing** (`/`): `text-display` title, one `muted` line, a `lg` primary `ButtonLink`.
- **Login**: `text-title`, `Field` + `Input`, a primary `Button`; `Alert` for the sent link.
- **Songs** (`/songs`): `PageHeader` with a primary "New song", then rows on `line` dividers.
- **New song**: `Field`s, the dashed drop zone, the progress bar, one primary submit.
- **Song** (`/songs/[id]`): `PageHeader`, the mix `Card` (waveform player + composer), the Comments `Card`, then the share
  `Card` (link in a read-only mono `Input`, secondary Copy link, `danger-link` Revoke).
- **Share redeem** (`/s/[token]`): centered `text-title`, one `muted` line, a `lg` primary "Listen".
- **Listen** (`/listen/[songId]`): `Wordmark`, title, the mix `Card` (with a primary "Post comment"), the Comments `Card`.

## Changing the system

1. Change it in the Claude Design system first (or agree the change in the PR), then here and in
   `globals.css` / the component, in the same PR.
2. Add or change a token for **both** themes and check contrast in both.
3. Take before/after screenshots in dark and light for the PR.
