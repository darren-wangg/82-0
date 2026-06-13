# Ultimate Draft

Mobile-first NBA Draft web game: spin for a
random team and era, draft an 8-player all-time roster (5 starters + 3
bench), and simulate a full 82-game season through an era-adjusted 9-cat
engine. Share teams, run head-to-head challenges, compete in group
lobbies, and climb the leaderboard.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind v4 + shadcn/ui (Base UI)
· Framer Motion · Prisma 7 + Postgres (Neon) · Auth.js v5 (anonymous-first)
· Vercel AI SDK + Claude.

## Commands

```bash
pnpm run dev            # dev server
pnpm test               # vitest (engine + contract tests)
pnpm run build          # production build (runs prisma generate first)
npx prisma migrate dev # evolve the database (interactive)
pnpm run etl            # rebuild public/data/snapshot-v1.json from source data
pnpm run etl:headshots  # resolve fallback player images (cached, resumable)
```

## Docs

- [System design](docs/system-design.md) — architecture and flow diagrams
- [Technical overview](docs/technical-overview.md) — core components and logic
- [Scaling plan](docs/scaling.md) — concrete productionization steps

## Architecture notes

- `src/lib/contracts.ts` is the shared surface: all types, zod schemas, the
  engine API, and route payloads. Change it deliberately — everything
  depends on these shapes.
- Game/API code reaches the engine only via `getEngine()`
  (`src/lib/engine-provider.ts`) and player data only via `src/lib/snapshot.ts`.
- The server is authoritative: API routes re-run the engine on save;
  client-computed results are never persisted.
- The draft is a pure seeded reducer (`src/components/game/draft-state.ts`)
  persisted to localStorage; the engine (`src/engine/`) is pure TS with
  golden-master and property tests.

## Data & attribution

- Player and team statistics are derived from the
  [NBA Stats (1947–present)](https://github.com/sumitrodatta/bball-reference-datasets)
  dataset by Sumitro Datta (also on Kaggle), licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and itself
  compiled from Basketball-Reference.com data.
- Player headshots come from the NBA's public CDN (unofficial) with fallbacks
  from Wikipedia/Wikimedia Commons — each image's author and license are on
  its Commons file page — and, last, community images from
  [theSportsDB](https://www.thesportsdb.com/). A silhouette renders when no
  image exists.
- Pre-1974 STL/BLK, pre-1978 TOV, pre-1980 3PM, and early-era ORtg/DRtg are
  estimates, flagged via `estimatedCats` and marked "est." in the UI.
