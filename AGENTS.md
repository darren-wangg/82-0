<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 82-0 Plus

Mobile-first web app expanding the viral 82-0 NBA draft game: 8-player rosters
(5 starters + 3 bench), 9-cat stats + OFF/DEF ratings, era-adjusted simulation
engine, share links / head-to-head challenges / async lobbies / leaderboards,
and AI-generated team & matchup explanations.

Stack: Next.js (App Router) + React + TypeScript, Tailwind v4 + shadcn/ui,
Framer Motion, Prisma 7 + Postgres, Auth.js v5, Vercel AI SDK + Claude.

## Hard rules

- **`src/lib/contracts.ts` is FROZEN.** All types, zod schemas, engine API, and
  route payloads live there. Never edit it during Wave 1 work; build to it.
- Game/API code gets the engine only via `getEngine()` in
  `src/lib/engine-provider.ts` and player data only via `src/lib/snapshot.ts`.
  Never import `engine-mock` or snapshot JSON directly.
- Server is authoritative: API routes re-run the engine on save; client-computed
  results are never persisted.

## Path ownership (Wave 1 parallel tasks)

| Area | Paths |
|---|---|
| Data pipeline (A) | `scripts/etl/**`, `public/data/**`, `data/nicknames.json` |
| Engine (B) | `src/engine/**` |
| Game UI (C) | `src/app/(game)/**`, `src/components/game/**` |
| Social + AI (D) | `src/app/api/**`, `src/app/(social)/**`, `src/lib/auth.ts`, `src/components/social/**` |

Shared (frozen in Wave 1): `src/lib/*`, `prisma/schema.prisma`, `fixtures/*`.

## Commands

- `npm run dev` — dev server
- `npm test` — vitest (engine + contract tests)
- `npm run build` — production build (must stay green)
- `npx prisma generate` — regenerate client to `src/generated/prisma` (config in
  `prisma.config.ts`; no live DB needed). DB migrations are deferred until a
  Neon/local Postgres exists — social routes should be written but can't be
  integration-tested against a DB yet.

## Data notes

- Player data: one-time ETL from open Basketball-Reference-derived dataset
  (CC BY-SA, attribute it) → `public/data/snapshot-v1.json`. No live sports APIs;
  no scraping basketball-reference.com.
- Headshots: `headshotUrl()` in contracts (NBA CDN, unofficial) with silhouette
  fallback — never assume the image loads.
- Pre-1974 STL/BLK/TOV and old-era ratings are estimates; `estimatedCats` flags
  them and the UI should mark them (e.g. "est.").
