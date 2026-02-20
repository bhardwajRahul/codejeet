# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeJeet is a Next.js 16 app for browsing company-wise LeetCode DSA questions and system design chapters. It uses Clerk for auth, shadcn/ui components, and reads question data from CSV files (no database).

## Commands

- **Dev:** `pnpm dev` (uses Turbopack)
- **Build:** `pnpm build`
- **Lint:** `pnpm lint` / `pnpm lint:fix`
- **Format:** `pnpm format` (Prettier) / `pnpm format:check`
- **Pre-commit hook:** Husky runs lint-staged (Prettier auto-format) on commit

## Architecture

### Data Layer — CSV-based, no database

All question data lives in `data/*.csv` (one CSV per company, ~200+ files). The server-side module `lib/data.ts` reads and parses all CSVs at startup, caches them in memory, and exposes query/filter functions (`getQuestions`, `getCompanies`, `getTopics`).

### API Routes

- `app/api/questions/route.ts` — Main endpoint. Accepts query params for filtering (companies, difficulties, topics, timeframes, search, pagination). Returns questions + companies list.
- `app/api/companies/route.ts` — Returns all company names.
- `app/api/topics/route.ts` — Returns all unique topics.
- `app/api/health/route.ts` — Health check.

All API responses use aggressive `Cache-Control: immutable` headers.

### Client-side Caching

The dashboard client (`app/dashboard/page.client.tsx`) caches the full API response in `localStorage` keyed by `CACHE_VERSION` from `lib/cache-version.ts`. When updating the data or API shape, bump `CACHE_VERSION` to bust client caches.

### Dashboard (Server + Client split)

`app/dashboard/page.tsx` is a statically rendered server component (`force-static`) that renders `page.client.tsx`. The client component fetches from `/api/questions`, handles auth state via Clerk's `useAuth()`, and renders `LeetCodeDashboard`.

### System Design Pages

Markdown-based content in `public/system-design/` with numbered folders (e.g., `01. Scaling/README.md`). Each markdown file uses gray-matter frontmatter with `slug`, optional `video` (YouTube), and `podcast` (Spotify) fields. Pages are statically generated (`force-static`, `dynamicParams: false`).

### Auth

Clerk (`@clerk/nextjs`). The middleware is in `proxy.ts` (not the standard `middleware.ts`). Public routes: `/`, `/sign-in`, `/sign-up`, `/api/*`. All other routes require authentication.

### UI Stack

- shadcn/ui (new-york style) with Radix primitives — components in `components/ui/`
- Tailwind CSS v3 with oklch color tokens defined in `app/globals.css`
- Magic UI animation components in `components/magic-ui/`
- Fonts: Plus Jakarta Sans (sans) + JetBrains Mono (mono)
- Dark theme default via `next-themes`

### Path Aliases

`@/*` maps to project root (e.g., `@/components`, `@/lib`, `@/utils`, `@/hooks`).

## Key Conventions

- Package manager is **pnpm** (specified in `packageManager` field)
- Next.js output mode is `standalone`
- Prettier config: double quotes, semicolons, 100 char width, es5 trailing commas
- `utils/utils.ts` has general helpers (e.g., `capitalizeWords`); `lib/utils.ts` has the shadcn `cn()` merge utility
