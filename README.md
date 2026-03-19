## CodeJeet

Browse 17,000+ company-wise LeetCode interview questions from 660+ companies. Filter by company, topic, and difficulty. Fully static, no server required.

**https://codejeet.com**

### Features

- **Company-wise questions** — 663 companies with frequency-sorted questions (Google, Amazon, Meta, Apple, Microsoft, etc.)
- **Filtering** — by company, difficulty (Easy/Medium/Hard), topic, premium status, and timeframe
- **Full-text search** — search across titles, companies, and topics
- **Progress tracking** — checkbox each question, persisted in localStorage
- **Company comparison** — side-by-side comparison of question sets between two companies
- **System design** — 16 chapters covering scaling, rate limiting, consistent hashing, URL shortener, chat systems, and more
- **Blog** — 2,700+ articles on DSA and interview prep
- **Audiobook** — built-in player for "The Accidental CTO"

### Tech Stack

- **Next.js 16** (static export) with React 19
- **TypeScript**
- **Tailwind CSS** with OKLCH color tokens
- **shadcn/ui** (new-york style) + Radix primitives
- **Cloudflare Pages** for deployment

### How It Works

Question data lives in 663 CSV files (`data/companies/`), one per company. At build time, a prebuild script parses all CSVs into a single `public/data/questions.json`. The dashboard fetches this JSON client-side and caches it in localStorage.

No API routes. No database. No auth. Everything is statically generated.

### Development

```bash
# Install dependencies
pnpm install

# Run dev server (Turbopack)
pnpm dev

# Build for production
pnpm run prebuild   # generates public/data/questions.json from CSVs
pnpm build          # static export to out/

# Lint & format
pnpm lint
pnpm format
```

### Deployment

```bash
pnpm run build:worker   # build for Cloudflare
pnpm run preview        # local preview with Wrangler
pnpm run deploy         # deploy to Cloudflare Pages
```

### Project Structure

```
app/                  Next.js App Router pages
components/           React components (shadcn/ui + custom)
  ui/                 shadcn primitives
  magic-ui/           animation components
lib/                  data loading, stores, SEO, utilities
data/companies/       663 CSV files (one per company)
public/system-design/ 16 markdown-based chapters
content/              blog markdown files
scripts/              build-data.ts (CSV → JSON prebuild)
```

### License

[GPL-3.0](LICENSE)
