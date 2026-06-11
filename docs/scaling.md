# 82-0 Plus — Productionization & Scaling Plan

Concrete steps to take this from a working app to a production service.
Ordered by phase; each item says what to do and why it matters here
specifically.

## What already scales

Worth naming, because it shapes everything below:

- **The core game costs the server nothing.** Drafting and season simulation
  run entirely in the browser against a bundled static snapshot. Viral
  traffic to `/play` is CDN traffic, not compute.
- **The engine is deterministic**, so anything computed can be cached or
  recomputed identically (matchups have stable seeds; explanations are
  content-hashed).
- **Team reads are denormalized** (ovr/wins/profile on the row), so share
  pages and leaderboards are single-query reads.
- **Every route already degrades** to a typed 503 when the DB is down.

The bottlenecks that *will* appear: the snapshot in the client bundle, the
O(n²) lobby standings computed on every read, Postgres connections from
serverless, and AI spend.

## Phase 1 — Launch hardening (do before real users)

1. **CI pipeline** (GitHub Actions): `lint` + `vitest` + `next build` on every
   PR; `prisma migrate deploy` against production runs in the release job, not
   from laptops. Block merge on red.
2. **E2E suite** (the one remaining plan item): Playwright mobile-viewport
   flows — draft → sim → save → open share link in a fresh context →
   challenge → lobby enter/close → explanation streams. Run on preview
   deploys; this is the only automated coverage of the social loop.
3. **Error monitoring + logging**: Sentry (client + server) with release
   tagging, plus structured logs in API routes (route, anon id hash, lobby
   code). Today a failed save is invisible.
4. **Rate limiting** (deliberately skipped in v1): Upstash Ratelimit or
   Vercel WAF rules on the write endpoints — `/api/teams`, `/api/lobbies*`,
   `/api/matchups` (per anon identity + IP) — and a much tighter budget on
   `/api/explain` (it spends real money; see Phase 4).
5. **Database operations**:
   - Use Neon's **pooled connection string** (PgBouncer) for the app; the
     direct URL only for migrations. Serverless + per-invocation connections
     is the classic first outage.
   - Enable point-in-time recovery / daily backups on the Neon project.
   - Set Prisma query timeouts so a slow query can't pin a function to the
     10s/60s limit.
6. **Secrets & config**: `ANON_SECRET` documented + rotation story (rotating
   it logs every anonymous device out of its identity — acceptable, but do it
   knowingly); `metadataBase`/site URL set for the production domain;
   `robots.txt` + minimal sitemap.
7. **Legal/compliance pass**:
   - Dataset attribution is in place (footer + README); keep it visible.
   - The NBA logo favicon, team names, and CDN headshots are **unlicensed
     trademark/likeness use**. Fine for a hobby project; get an opinion (or
     swap to a neutral basketball mark and generic franchise names) before
     monetizing or marketing the production app.
   - One-paragraph privacy note: anonymous cookie, optional Google sign-in,
     what's stored.

## Phase 2 — Client performance

8. **Get the snapshot out of the JS bundle** (the single biggest win). It's
   ~1.6 MB raw (plus the 86 KB fallback map) compiled into client chunks
   today via `import`. Replace the static import in `src/lib/snapshot.ts`
   with a fetch of `/data/snapshot-v1.json` (immutable cache headers, version
   in the filename) behind the same `getSnapshot()` API, with a loading state
   in `GameProvider`. The JSON then rides the CDN, gzips to a fraction of its
   size, and stops blocking hydration. Optional second step: split pools per
   franchise so `/play` only pulls what the spin needs.
9. **HTTP caching on hot reads**: `s-maxage=60, stale-while-revalidate` on
   the leaderboard and lobby GETs; long-lived caching (or ISR) on `/t/[slug]`
   pages, which are immutable once saved. The OG images already cache.
10. **Image budget**: Vercel image optimization is metered; the headshot set
    is finite (~1,600 sources). Either keep optimizer caching (fine at small
    scale) or pre-generate the two sizes used and serve them as static files
    to take the optimizer out of the hot path.

## Phase 3 — Server hot paths

11. **Materialize lobby standings.** Today every lobby page view runs a full
    round-robin (n·(n−1)/2 seeded series sims) plus N team rows. Fine at 10
    entries; not at 200 viewers refreshing a 50-entry lobby. Because sims are
    deterministic, compute incrementally: on each entry, simulate only the
    new pairings, persist results (the `Matchup` table already fits), and
    store a standings JSON on the lobby row bumped by entry count. Reads
    become one row.
12. **Add the missing read indexes as usage reveals them** — the obvious ones
    (`Team(snapshotVersion, wins, ovr)`, `Team(createdAt)`, lobby uniques)
    already exist; watch Neon's slow-query log rather than guessing.
13. **Background jobs**: nothing currently needs a queue (lobby expiry is
    computed on read, on purpose — no cron required). If you later want
    push-style notifications ("your lobby closed, you won"), add Inngest or
    QStash then, not now.

## Phase 4 — AI cost control

14. The content-hash cache already makes each unique team/matchup a one-time
    cost. Add on top:
    - per-identity rate limit (e.g. 5 generations/hour) and a global daily
      budget alarm,
    - `maxOutputTokens` cap on the stream (responses are short by prompt
      design; enforce it),
    - a cheap-model fallback or canned copy when the budget trips, so the
      page never breaks.

## Phase 5 — Observability & rollout

15. **Dashboards/alerts**: 5xx rate per route, DB availability (the
    `isDbUnavailable` path is a perfect metric hook), p95 on
    `/api/lobbies/[code]`, AI spend/day, image-optimizer usage.
16. **Staging that matches prod**: Neon branch per preview deploy (cheap,
    instant, real schema), seeded with a small fixture set. E2E runs there.
17. **Snapshot release process**: a new `snapshot-vN` is a game-balance
    event, not a data deploy — run `dist-check`, re-baseline goldens, ship
    engine + snapshot together, and let the leaderboard's
    `snapshotVersion` scoping start the new season cleanly. Keep old
    versions served so existing share links keep rendering.

## Phase 6 — If it actually gets big

18. **Postgres first**: Neon autoscaling covers a lot; past that, add a read
    replica for leaderboard/lobby/team reads (all tolerate seconds of lag)
    and keep writes on the primary.
19. **Edge reads**: leaderboard and team pages are cacheable JSON + HTML;
    moving them to edge runtime with KV/cache-tag invalidation removes the
    DB from the read path almost entirely.
20. **Live lobbies / realtime** (currently an explicitly-deferred
    fast-follow): polling is fine below ~1k concurrent lobby viewers; beyond
    that, a realtime provider (Ably/Pusher/PartyKit) for standings pushes —
    don't run websockets through Next on Vercel.
21. **Load-test the two real hot paths** before any marketing push: lobby
    page reads and team saves. Everything else is static or cached.

## Explicit non-goals

- Microservices, containers, or a separate API tier — the engine is a pure
  library and the whole backend is a handful of CRUD routes; Vercel
  serverless + Postgres is the right shape until well past product-market
  fit.
- Multi-region writes — share links and lobbies tolerate single-region write
  latency; a CDN already serves everything latency-sensitive.
