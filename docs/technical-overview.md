# 82-0 Plus — Technical Overview

What each core component does and the logic inside it. Companion to
[system-design.md](./system-design.md) (diagrams) and
[scaling.md](./scaling.md) (productionization).

## 1. Contracts (`src/lib/contracts.ts`)

The single shared surface between the four areas of the codebase: data
pipeline, engine, game UI, and social/AI backend. It holds every cross-area
type (`PlayerStatLine`, `Roster`, `TeamRating`, `SeasonResult`,
`MatchupResult`), the zod schemas that validate them at the boundaries
(snapshot load, API request bodies, persisted drafts), the `Engine` interface,
and tuning-visible constants (`SEASON_GAMES`, `OVR_MAX = 100`,
`BENCH_WEIGHT = 0.4`, `LOBBY_DURATION_HOURS = 24`). Treat changes as breaking:
every consumer builds against these exact shapes.

## 2. Data pipeline (`scripts/etl/`)

One-time/on-demand build from the CC BY-SA Basketball-Reference-derived
dataset (no live sports APIs, no scraping):

- **Peak-season selection** — for each player × franchise × decade, take the
  season line that maximizes the draft-relevant composite. A player can appear
  in several pools (e.g. Kareem in 1970s Bucks and 1980s Lakers) but each pool
  line is one real season, not a blend.
- **Era baselines** — league-average 9-cat values (and ORtg/DRtg) per decade.
  These are what make a 1960s rebound and a 2020s rebound comparable.
- **Estimates** — STL/BLK before 1974, TOV before 1978, 3PM before 1980, and
  early-era ratings don't exist in the source; they're regressed from
  position/profile and flagged in `estimatedCats` so the UI can mark them
  ("est.") and nobody mistakes them for measurements.
- **Position enrichment** — the source lists one position per season. Alt
  positions come from play-by-play minute shares (≥15% share, ≥200 minutes,
  1997+) plus the union of positions listed across the player's career; 64%
  of pool lines end up with at least one alt position, which feeds roster
  eligibility.
- **Headshot resolution** (`headshots.ts`) — the NBA CDN returns HTTP 200 with
  a generic placeholder for unknown players, so coverage is determined by
  content hash, not status code. Misses go through Wikipedia page-summary
  thumbnails (rate-limit-aware, basketball-page-only), then a bulk Wikidata
  SPARQL pass (P18 images, unambiguous name matches, deterministic md5 thumb
  URLs, HEAD-verified). ~80% of the 1,970 unique players end up with a real
  image; the rest get a silhouette.

Output: `public/data/snapshot-v1.json` (~1.6 MB; franchises, decade pools,
player lines, baselines, attribution) and `headshot-fallbacks-v1.json`. Both
are versioned — saved teams record their `snapshotVersion`.

## 3. Engine (`src/engine/`)

Pure TypeScript, zero dependencies, fully deterministic (seeded mulberry32 for
anything random). The pipeline per team:

1. **`eraAdjust`** — convert each player's raw line into z-scores against
   their decade's baselines, clamped to ±4.5 so outliers (Wilt) are elite,
   not infinite. TOV is sign-flipped so positive always means good.
2. **`playerScore`** — weighted 9-cat composite (`CAT_WEIGHTS`, sums to 1.0;
   PTS/REB/AST carry ~65%, TPM/TOV are deliberately near-zero) blended 70/30
   with an ORtg/DRtg term.
3. **`teamRating`** — the **construction model**, not a flat average. Each
   category is aggregated across the roster with a rank-decay OWA (`dirAgg`):
   the top contributor drives it, the next counts γ as much, the next γ², and
   so on. This is deliberately asymmetric to mirror the sport — **offense
   leans toward the best contributor** (star-driven, sort descending) while
   **defense and ball-security lean toward the weakest link** (one
   non-defender gets hunted, sort ascending). Two properties fall out for
   free: redundancy is taxed (a second elite scorer earns only a fraction of
   the first's credit) and complementarity + two-way balance are rewarded,
   with no explicit balance term. The aggregation is monotone, so a better
   player never lowers the team's value. Starters and bench aggregate as
   separate blocks and blend (bench discounted at `BENCH_BLOCK_W = 0.45`),
   which keeps monotonicity across the starter/bench boundary. Out-of-position
   play rides in as a monotone multiplier (mean starter position factor,
   1.0 → 0.75 by distance along PG–SG–SF–PF–C). The composite maps to
   `OVR = 36.3 + 42.4 × posMult × composite`, clamped to [0, 100]. OFF/DEF are
   0–100 sub-ratings calibrated onto the *same scale as OVR* (per-side base +
   slope), so a 90+ OVR team no longer reads OFF/DEF in the 60s; the concave
   9-cat z-profile (`catProfile`) feeds the UI bars and the AI prompts.
4. **`projectSeason`** — wins = `82 × (OVR / 100)^1.15`, then **category
   gates**: each cat's team z (the concave `catProfile` value) maps through
   per-category thresholds to a win cap; the binding gate is the minimum. This
   is the signature mechanic — one glaring weakness (e.g. a turnover-prone
   high-usage stack) caps the season no matter how strong everything else is.
   Calibrated so drafted rosters cluster around a ~65-win median, 70+ takes a
   top-decile draft, and a perfect 82-0 (~1 in 286 for a casual top-3 drafter)
   needs deliberate, hole-free construction around transcendent anchors — not
   just the biggest pile of box-score stats.
5. **`simulateMatchup`** — best-of-7. Per-game win probability is a logistic
   blend (65/35) of the OVR gap and the weighted category-edge sum; games are
   drawn with a seeded PRNG so the same pairing + seed always produces the
   same series. Returns the series score, per-cat edges, and `pGameA` for the
   AI recap.

Tests: golden masters (fixed rosters → exact OVR/record), property tests
(better stats never lower OVR, gates bind, determinism), and a distribution
check over simulated drafts (`scripts/etl/dist-check.ts`) used for re-tuning.
Golden values are re-baselined deliberately whenever constants change.

## 4. Draft game (`src/components/game/`)

- **`draft-state.ts`** — a pure reducer over `GameState`, the heart of the
  game. Randomness is derived from `(seed, rngCursor)` so the whole game is
  replayable; every spin appends to `spunCombos` so the same franchise×decade
  never comes up twice in one game. Rules encoded here: 8 rounds, 2 of 7
  decades excluded per game, 1 team re-spin + 1 era re-spin, slot eligibility
  (starters need the exact position, bench slots take G/F/C groups), no
  drafting the same human twice across eras, and free rearranging during the
  draft. `eligibleCombos` guarantees a spin always lands on a pool with at
  least one draftable player.
- **Persistence** — state serializes to localStorage on every action and
  revives through a zod schema where every newer field has a `.default()`,
  so old saves migrate forward silently. A stored game referencing a
  different `snapshotVersion` or missing players is discarded.
- **`game-provider.tsx`** — client-only store wrapping the reducer; state is
  `null` until restored to avoid hydration mismatches.
- **Screens** — `/play` (slot-machine reels, pool list, roster board),
  `/sim` (count-up record, OVR dial, OFF/DEF bars, 9-cat profile with the
  info popover, save-to-device and share/lobby/challenge modals). Draft
  params (`?challenge=`, `?lobby=`) retarget a fresh game and are carried in
  `GameState` until save.

## 5. Social backend (`src/app/api/`, `src/app/(social)/`)

- **Identity** — anonymous-first. `getOrCreateAnonId()` sets a signed
  httpOnly cookie mapping to an `AnonIdentity` row; optional Google sign-in
  (Auth.js v5) links the identity and claims its teams. Display names only
  exist for signed-in users.
- **Teams** — `POST /api/teams` validates the roster against the current
  snapshot, recomputes everything server-side, and stores the team with
  denormalized engine outputs (ovr/wins/cat profile) for cheap reads. Slugs
  are short and collision-retried. `/t/{slug}` renders the shared team with
  a dynamic OG card.
- **Challenges** — `POST /api/matchups` simulates a deterministic best-of-7
  between two saved teams (seed = stable hash of the slug pair, so results
  are idempotent and cacheable by unique constraint).
- **Lobbies** — 24-hour windows (`closesAt` derived from `createdAt`, or
  `closedAt` when the creator ends it early). Entries must be drafted fresh
  (`team.createdAt >= lobby.createdAt`), owned by the entering device, one
  per device. Standings are a full round-robin computed on read with stable
  per-pairing seeds; the winner is crowned when the lobby closes.
- **Leaderboard** — top 50 by wins then OVR, global or trailing-7-day,
  scoped to the current `snapshotVersion` so a data re-release resets fairly.

All routes degrade gracefully when the DB is unreachable (typed 503s via
`isDbUnavailable`), because the core game never needs the database.

## 6. AI explanations (`/api/explain`)

Streaming Claude responses (Vercel AI SDK) for two prompt kinds: team
scouting reports and matchup recaps. Prompts are built **only from structured
engine output** (ratings, cat profiles, gate, series result) — the model
never sees raw stats or free-form user input beyond the team name.
Responses are cached in Postgres by
`sha256(kind + canonical payload + prompt version)`, so each unique team or
matchup pays for one generation ever; cache hits stream straight from the DB
row. No API key → clean 503 the UI treats as "scouting unavailable".

## 7. Headshot chain (`src/lib/headshots.ts`, `PlayerHeadshot` components)

`headshotSources()` returns `[NBA CDN url?, Wikimedia fallback?]`; the
components walk the list on `onError` and end at a silhouette. Everything is
proxied through the Next image optimizer (`remotePatterns` for
`cdn.nba.com` and `upload.wikimedia.org`) so clients never hit third-party
hosts directly and images get resized/cached at the edge.
