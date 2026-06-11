# 82-0 Plus — System Design

How the pieces fit together and how data flows through them. See
[technical-overview.md](./technical-overview.md) for what each component does
internally and [scaling.md](./scaling.md) for the productionization path.

## High-level architecture

```mermaid
flowchart LR
    subgraph Offline["Offline (one-time / on-demand)"]
        DS[("Basketball-Reference-derived<br/>dataset (CC BY-SA)")]
        ETL["ETL pipeline<br/>scripts/etl/build.ts"]
        HS["Headshot resolver<br/>scripts/etl/headshots.ts"]
        WIKI["Wikipedia / Wikidata APIs"]
        DS --> ETL
        WIKI --> HS
    end

    subgraph Client["Browser (mobile-first)"]
        GAME["Draft game<br/>pure reducer + localStorage"]
        SOCIAL["Social pages<br/>/t /m /l /leaderboard"]
    end

    subgraph Server["Next.js (Vercel)"]
        PAGES["Server components"]
        API["API routes<br/>/api/teams /api/matchups<br/>/api/lobbies /api/explain"]
        ENGINE["Engine (pure TS)<br/>src/engine"]
        SNAP[("snapshot-v1.json<br/>+ headshot-fallbacks-v1.json")]
    end

    PG[("Postgres (Neon)<br/>teams, matchups, lobbies,<br/>identities, AI cache")]
    CLAUDE["Claude API<br/>(Vercel AI SDK)"]
    CDN["NBA CDN +<br/>upload.wikimedia.org"]

    ETL --> SNAP
    HS --> SNAP
    GAME -- "imports snapshot,<br/>runs engine locally" --> ENGINE
    GAME -- "save / challenge / lobby" --> API
    SOCIAL --> PAGES
    PAGES --> PG
    API --> ENGINE
    API --> PG
    API -- "explanations" --> CLAUDE
    Client -- "headshots via<br/>Next image optimizer" --> CDN
```

Three trust zones:

1. **Offline ETL** produces a versioned, static snapshot. Nothing at runtime
   touches the source dataset or scrapes anything.
2. **The client** owns the draft experience end-to-end (spin, pick, simulate)
   against its bundled snapshot copy — zero network needed to play.
3. **The server is authoritative for anything persisted or competitive.**
   Every API route re-runs the engine on the submitted roster; client-computed
   numbers are never stored.

## Core game flow (draft → sim → save)

```mermaid
sequenceDiagram
    actor U as Player
    participant D as Draft reducer (client)
    participant E as Engine (client copy)
    participant API as /api/teams
    participant SE as Engine (server copy)
    participant DB as Postgres

    U->>D: SPIN (seeded RNG, no repeat team+era)
    D-->>U: franchise × decade pool
    U->>D: SELECT_PLAYER + PLACE (×8 rounds)
    Note over D: state persisted to localStorage<br/>after every action
    D->>E: teamRating + projectSeason
    E-->>U: record, OVR, OFF/DEF, 9-cat, gate
    U->>API: POST roster + name (Share)
    API->>SE: validate roster, recompute rating/season
    SE-->>API: authoritative outputs
    API->>DB: Team row (slug, denormalized outputs)
    API-->>U: /t/{slug} share link
```

The same save call branches at the end for the two competitive modes:

- **Challenge** (`/play?challenge={slug}`): after saving, the client posts
  `/api/matchups`; the server simulates a deterministic best-of-7 between the
  two saved teams (seed = stable hash of the slugs) and the client lands on
  `/m/{id}`.
- **Lobby** (`/play?lobby={code}`): after saving, the client posts
  `/api/lobbies/enter`; the server enforces lobby rules (below) and the client
  lands on the standings.

## Lobby lifecycle

```mermaid
stateDiagram-v2
    [*] --> Open: creator POSTs /api/lobbies<br/>(device cookie = creator)
    Open --> Open: anyone with the link drafts fresh<br/>via /play?lobby={code} and enters
    Open --> Closed: 24h window lapses
    Open --> Closed: creator POSTs /close
    Closed --> [*]: winner = top of standings<br/>(round-robin, deterministic seeds)
```

Entry rules enforced server-side in `/api/lobbies/enter`:
team must belong to the calling device's anonymous identity, must have been
created *after* the lobby opened (no loading saved teams), and the DB unique
constraint `(lobbyCode, anonIdentityId)` allows one entry per device.

## Identity model

```mermaid
flowchart LR
    C["Device cookie<br/>(signed anon id, httpOnly)"] --> A["AnonIdentity row"]
    A -- "owns" --> T["Teams / lobby entries"]
    G["Google sign-in (Auth.js)"] -- "links on first sign-in" --> A
    G --> U["User row<br/>(display name, leaderboard claim)"]
```

Anonymous-first: every device gets a signed identity cookie on its first
write; sign-in is optional and retroactively claims the device's teams.

## Data pipeline

```mermaid
flowchart TD
    CSV["Season CSVs<br/>(per-game, play-by-play, ratings)"] --> PEAK["Peak season per<br/>player × franchise × decade"]
    CSV --> POS["Position enrichment<br/>(PBP minute shares + career union)"]
    CSV --> BASE["Era baselines per decade<br/>(league-average 9-cat + ratings)"]
    PEAK --> EST["Estimate pre-1974 STL/BLK,<br/>pre-1978 TOV, old ratings<br/>(flagged estimatedCats)"]
    POS --> SNAPJ["snapshot-v1.json<br/>(franchise × decade pools)"]
    EST --> SNAPJ
    BASE --> SNAPJ
    NBAIDS["nba_api id index"] --> SNAPJ
    SNAPJ --> CHK["Validation: known stat lines,<br/>non-empty pools, golden engine runs"]
```

Headshots resolve separately (NBA CDN content-hash check → Wikipedia page
thumbnails → Wikidata P18 Commons images → silhouette), emitting
`headshot-fallbacks-v1.json`. The UI chains sources and never assumes an
image loads.
