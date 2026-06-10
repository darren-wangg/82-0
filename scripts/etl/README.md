# 82-0 Plus data pipeline (Wave 1A)

One-time ETL that builds `public/data/snapshot-v1.json` — the era-spanning
player snapshot consumed by the game via `src/lib/snapshot.ts` — and the
Prisma seed for the `Player` / `PlayerSeason` tables.

## How to re-run

```bash
npm run etl          # builds public/data/snapshot-v1.json
npm test             # includes scripts/etl/validate.test.ts (snapshot sanity)
npx tsx scripts/etl/seed.ts   # seeds Postgres (requires DATABASE_URL; not run in Wave 1)
```

Source files are cached under `scripts/etl/.cache/` (gitignored). Delete the
cache to force a re-download. The snapshot itself **is** committed.

## Data source, license & attribution

- **Player/team statistics:** the open ["NBA Stats (1947-present)"](https://github.com/sumitrodatta/bball-reference-datasets)
  dataset by **Sumitro Datta** (also published on Kaggle), licensed
  **CC BY-SA 4.0**, itself compiled from Basketball-Reference.com data.
  Files used: `Player Per Game.csv`, `Per 100 Poss.csv`, `Team Summaries.csv`
  (fetched from the repo's raw GitHub URLs — basketball-reference.com is never
  scraped). `Advanced.csv` is also cached but not currently used.
- **Headshot ids:** the static players list from the
  [nba_api](https://github.com/swar/nba_api) project (MIT). Names are matched
  after normalization (diacritics, punctuation, Jr./Sr./II… suffixes removed);
  an id is assigned only when the normalized name is unique in **both**
  sources, so name collisions never attach the wrong face. Headshot images are
  served from the NBA CDN via `headshotUrl()` with a silhouette fallback.
- **Nicknames:** `data/nicknames.json` is a hand-curated map of ~280 well-known
  nicknames keyed by bbref slug, merged into the snapshot at build time.

The combined attribution string is embedded in the snapshot's `attribution`
field.

## Pipeline rules

- **Scope:** NBA + ABA seasons ending 1960–2026, decades `1960s`–`2020s`.
  Decade is keyed by the season's *ending* year (1969-70 → `1970s`).
- **Franchises:** every historical team code is normalized to its modern
  franchise id per the NBA's official lineages (`franchises.ts`): Philadelphia/
  San Francisco Warriors → GSW, Cincinnati Royals/KC Kings → SAC, Seattle
  SuperSonics → OKC, NJ/NY Nets (+ABA Americans) → BKN, Syracuse Nationals →
  PHI, St. Louis Hawks → ATL, Bullets lineage → WAS, ABA Denver/Indiana/
  San Antonio survivors, etc. Defunct ABA teams with no NBA successor
  (Kentucky Colonels, Spirits of St. Louis, Virginia Squires, …) are excluded.
- **Qualifying seasons:** a player×franchise season qualifies with
  `GP ≥ round(scheduleGames / 2)` where `scheduleGames` is the longest team
  schedule that season — i.e. 41 of 82, automatically pro-rated for 1960s
  short schedules and the 1999/2012/2020/2021 seasons. Multi-team aggregate
  rows (`2TM`…) are skipped; each franchise stint stands on its own games.
- **Peak season:** per player×franchise×decade, the qualifying season with the
  best composite 9-cat per-game score:
  `pts + 1.2·reb + 1.5·ast + 2·stl + 2·blk + 1.5·tpm − tov
   + 2.5·(fgPct − lgFgPct)·fga + 2·(ftPct − lgFtPct)·fta`
  (league shooting context is games-weighted per season+league, so percentage
  impact is volume-aware and era-relative).
- **Pools:** each franchise×decade pool keeps the top 25 by the same composite
  score; `activeDecades` is derived from non-empty pools.
- **Positions:** the dataset's normalized primary position; `altPositions` are
  the other positions the player was listed at during that decade. 193 rows
  with position `NA` fall back to a stat heuristic (reb ≥ 10 → C, ≥ 7.5 → PF,
  ast ≥ 5 → PG, ≥ 3 → SG, else SF).
- **Era baselines:** per decade, mean and population SD of each 9-cat plus
  ORtg/DRtg across all pool members of that decade (SD floored at small
  epsilons — e.g. 0.05 for tpm — so z-scores never divide by zero).

## Estimated stats (`estimatedCats`)

Recording history: STL/BLK from 1973-74 (ABA 1972-73), TOV from 1977-78
(ABA from 1967-68), individual DRtg from 1973-74, individual ORtg from
1977-78, NBA 3-point line from 1979-80. Anything missing from the source is
estimated row-by-row and flagged (the UI shows "est."):

| Stat | Formula |
|---|---|
| `stl` | `STL36[pos] × mp/36`, STL36 = PG 1.7, SG 1.5, SF 1.3, PF 1.0, C 0.9 |
| `blk` | `BLK36[pos] × mp/36 × clamp(reb/10, 0.6, 1.8)`, BLK36 = PG 0.2, SG 0.3, SF 0.5, PF 1.1, C 1.9 (rebound factor separates true rim protectors) |
| `tov` | `0.075 × (FGA + 0.44·FTA) + 0.18 × AST` (≈7.5% of shooting possessions + assist volume; calibrated to observed rates once TOV was tracked) |
| `tpm` | `0` for NBA seasons before 1979-80 (no 3-point line); ABA 3PM is real data |
| `ortg` | `lgORtg × (1 + 0.75 × (TS/lgTS − 1)) + 0.5 × AST`, clamped to `lgORtg − 10 … + 18`. `lgORtg`/`lgTS` from the season's Team Summaries "League Average" row, so era pace/efficiency context is built in |
| `drtg` | `lgORtg − 0.15 × REB − 0.8 × STL − 0.8 × BLK`, clamped to `lgORtg − 12 … + 6` |

Estimated `stl`/`blk` feed the `drtg` estimate, and all estimates feed the
composite score, so pre-1974 players rank on the same scale as modern ones.

## Outputs

- `public/data/snapshot-v1.json` — validated against `SnapshotSchema`
  (`src/lib/contracts.ts`) before writing. ~4.5k player×franchise×decade
  lines, 30 franchises, 7 era baselines, 184 pools.
- `scripts/etl/seed.ts` — idempotent upserts of `Player` + `PlayerSeason`
  (Prisma 7 client from `src/generated/prisma`, `@prisma/adapter-pg`).
