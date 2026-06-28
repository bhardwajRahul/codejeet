# ressl.ai-style Visual Overhaul — Design

**Date:** 2026-06-28
**Scope:** Visual restyle only. No copy changes, no route/data/auth/structure changes.

## Goal

Reskin CodeJeet to match the ressl.ai aesthetic: a near-black technical canvas
built from thin grid/box lines, diagonal-hatch divider strips, monospace UI
chrome, and the signature **corner tick marks** on every framed box (the "edge
of boxes" detail).

## Decisions (approved)

- **Theme:** dark-only. Remove light mode + the (unused) toggle path; force dark.
- **Logo:** monochrome `codejeet` wordmark in JetBrains Mono (drop pixel/Google colors).
- **Type:** JetBrains Mono for all chrome (nav, buttons, badges, labels, table
  headers, metadata); Plus Jakarta Sans stays for large headings.
- **Build order:** design tokens + shared primitives + shared chrome + homepage
  this pass (cascades to all pages). Page-specific deep layouts swept later.

## Foundation (tokens)

- `globals.css`: neutralize palette to pure neutral near-black (chroma 0). Make
  the dark palette the single source of truth. Radius `0.625rem` → `2px`.
- `tailwind.config.ts`: `mono` family → JetBrains Mono var.
- `layout.tsx`: load JetBrains Mono via `next/font`, expose `--font-mono`,
  `forcedTheme="dark"`.

## Primitives (the look comes from these four)

1. **`<Frame>`** (`components/ui/frame.tsx`) — bordered box rendering crosshair
   "+" corner ticks at all four corners. Reused by buttons, badges, cards, rows.
2. **`GridRails`** — thin faint vertical border rails framing the central column.
3. **`<HatchDivider>`** — full-width diagonal-stripe strip via
   `repeating-linear-gradient`.
4. **`<SectionLabel>`** — small mono uppercase label with a leading bar marker.

## Restyled this pass

Tokens, `Button` (bordered mono + ticks), `Card` (sharp, no shadow, ticked),
`Navbar`, `Footer`, homepage hero (dot pattern → grid rails + hatch dividers +
framed badge/buttons). Exact existing copy preserved everywhere.

## Out of scope (inherits token/component restyle; bespoke sweep later)

Dashboard table internals, learn, blog, system-design, podcast, compare layouts.
