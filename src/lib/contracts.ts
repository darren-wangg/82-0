/**
 * FROZEN CONTRACTS — the shared surface between the data pipeline (scripts/etl),
 * the simulation engine (src/engine), the game UI (src/app/(game)), and the
 * social/AI backend (src/app/api, src/app/(social)).
 *
 * Wave 1 tasks must NOT edit this file. If a contract is wrong, stop and
 * resolve it centrally — every consumer depends on these exact shapes.
 *
 * This module is intentionally zod-free so client bundles importing contract
 * types and constants ship no schema runtime. The matching zod schemas live in
 * contracts-schemas.ts (equally frozen); compile-time parity assertions there
 * pin each schema to its type here.
 */

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

export const DECADES = [
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
] as const;
export type Decade = (typeof DECADES)[number];

export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type Position = (typeof POSITIONS)[number];

/** The 9 fantasy categories plus the two ratings used by the engine. */
export const NINE_CATS = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fgPct",
  "ftPct",
  "tpm",
  "tov",
] as const;
export type NineCat = (typeof NINE_CATS)[number];

/** Categories where a higher raw value is WORSE. */
export const NEGATIVE_CATS: readonly NineCat[] = ["tov"];

export const ROSTER_SIZE = 8;
export const STARTER_COUNT = 5;
export const BENCH_COUNT = 3;
/** Bench players contribute at this fraction of starter weight. */
export const BENCH_WEIGHT = 0.4;
export const DRAFT_ROUNDS = 8;
/** All eras are in play (the original game banned 2 per run; we ban none). */
export const EXCLUDED_DECADES_PER_GAME = 0;
export const TEAM_SKIPS_PER_GAME = 1;
export const ERA_SKIPS_PER_GAME = 1;
export const SEASON_GAMES = 82;
/** Team OVR scale ceiling (mirrors the documented 0–110 convention). */
export const OVR_MAX = 100;

// ---------------------------------------------------------------------------
// Snapshot (data pipeline output, game input) — validated by SnapshotSchema
// in contracts-schemas.ts at ETL time and in tests.
// ---------------------------------------------------------------------------

export interface NineCatLine {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  /** 0–1 fraction, e.g. 0.509 */
  fgPct: number;
  /** 0–1 fraction */
  ftPct: number;
  /** made threes per game */
  tpm: number;
  /** turnovers per game */
  tov: number;
}

export interface PlayerStatLine {
  /** Stable id: `${bbrefSlug}-${franchiseId}-${decade}` */
  id: string;
  /** Basketball-Reference style slug, e.g. "chambwi01" */
  playerSlug: string;
  name: string;
  /** Curated nickname; absent → UI falls back to last name. */
  nickname?: string;
  /** stats.nba.com person id for headshot CDN; absent → silhouette. */
  nbaPlayerId?: number;
  franchiseId: string;
  decade: Decade;
  /** Season label of the peak season used, e.g. "1961-62". */
  peakSeason: string;
  /** Primary listed position; engine applies out-of-position penalty off this. */
  position: Position;
  /** Secondary positions playable without penalty. */
  altPositions: Position[];
  stats: NineCatLine;
  /** Offensive rating (points produced per 100 possessions). */
  ortg: number;
  /** Defensive rating (points allowed per 100 possessions; lower is better). */
  drtg: number;
  /** Cats whose values are estimates (pre-1974 stl/blk/tov, pre-1980 tpm, ratings). */
  estimatedCats: string[];
}

export interface Franchise {
  /** Canonical modern id, e.g. "GSW" (covers Philadelphia/SF Warriors history). */
  id: string;
  name: string;
  /** Decades in which the franchise has a draftable pool. */
  activeDecades: Decade[];
}

/** A 9-cat stat line extended with the two per-100-possession ratings. */
export interface RatedNineCatLine extends NineCatLine {
  ortg: number;
  drtg: number;
}

/** Per-decade league mean and standard deviation for each cat + ratings. */
export interface EraBaseline {
  decade: Decade;
  mean: RatedNineCatLine;
  sd: RatedNineCatLine;
}
export type EraBaselines = Record<Decade, EraBaseline>;

export interface Snapshot {
  version: string; // e.g. "v1"
  generatedAt: string;
  attribution: string;
  franchises: Franchise[];
  baselines: EraBaseline[];
  players: PlayerStatLine[];
  /** franchiseId → decade → player ids (indexes into `players`). */
  pools: Record<string, Record<string, string[]>>;
}

export function headshotUrl(p: Pick<PlayerStatLine, "nbaPlayerId">): string | null {
  return p.nbaPlayerId
    ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${p.nbaPlayerId}.png`
    : null;
}

// ---------------------------------------------------------------------------
// Roster & draft state (client game state, persisted server-side on save)
// ---------------------------------------------------------------------------

export interface Roster {
  /** Position → PlayerStatLine id. All five required to simulate. */
  starters: Record<Position, string>;
  /** Exactly BENCH_COUNT ids. */
  bench: string[];
}

export interface SpinResult {
  franchiseId: string;
  decade: Decade;
}

export interface DraftState {
  /** Decades removed for this whole game (EXCLUDED_DECADES_PER_GAME of them). */
  excludedDecades: Decade[];
  round: number; // 1-based, up to DRAFT_ROUNDS
  spin: SpinResult | null;
  teamSkipsLeft: number;
  eraSkipsLeft: number;
  /** Drafted player ids in pick order. */
  picks: string[];
}

// ---------------------------------------------------------------------------
// Engine API — implemented in src/engine (Wave 1B), mocked in
// src/lib/engine-mock.ts until integration. Pure & deterministic.
// ---------------------------------------------------------------------------

/** Z-scores vs the player's decade baseline; sign-flipped for NEGATIVE_CATS
 *  and drtg so that higher always means better. */
export type AdjustedStats = Record<NineCat | "ortg" | "drtg", number>;

export interface TeamRating {
  /** 0–OVR_MAX composite. */
  ovr: number;
  /** 0–100 offensive sub-rating. */
  offRating: number;
  /** 0–100 defensive sub-rating. */
  defRating: number;
  /** Team-level adjusted score per category (starters + bench-weighted). */
  catProfile: Record<NineCat, number>;
}

export interface SeasonResult {
  wins: number;
  losses: number;
  ovr: number;
  /** The category whose gate capped the record, if any. */
  gatedCategory: NineCat | null;
  /** Max wins permitted by the binding gate (82 if ungated). */
  winCap: number;
}

export interface CatEdge {
  cat: NineCat;
  teamA: number;
  teamB: number;
  /** Positive favors A, negative favors B. */
  edge: number;
}

export interface MatchupResult {
  winner: "A" | "B";
  /** Best-of-7 series score, winner first is NOT guaranteed — [A wins, B wins]. */
  seriesScore: [number, number];
  /** Per-game win probability for team A in [0,1]. */
  pGameA: number;
  catBreakdown: CatEdge[];
  seed: number;
}

export interface Engine {
  eraAdjust(stats: PlayerStatLine, baselines: EraBaselines): AdjustedStats;
  /** Scalar composite of one player's adjusted stats (higher is better). */
  playerScore(adjusted: AdjustedStats): number;
  teamRating(
    roster: Roster,
    players: Map<string, PlayerStatLine>,
    baselines: EraBaselines
  ): TeamRating;
  projectSeason(rating: TeamRating): SeasonResult;
  /** Deterministic for a given (a, b, seed). */
  simulateMatchup(a: TeamRating, b: TeamRating, seed: number): MatchupResult;
}

// ---------------------------------------------------------------------------
// API route payloads (Wave 1D) — request schemas in contracts-schemas.ts
// ---------------------------------------------------------------------------

export interface SaveTeamRequest {
  teamName: string;
  roster: Roster;
  snapshotVersion: string;
}

export interface SavedTeam {
  slug: string;
  teamName: string;
  roster: Roster;
  snapshotVersion: string;
  rating: TeamRating;
  season: SeasonResult;
  ownerDisplayName: string | null;
  createdAt: string;
}

export interface SaveTeamResponse {
  team: SavedTeam;
  url: string; // /t/{slug}
}

export interface CreateMatchupRequest {
  teamSlugA: string;
  teamSlugB: string;
}

export interface MatchupResponse {
  id: string;
  teamA: SavedTeam;
  teamB: SavedTeam;
  result: MatchupResult;
}

export interface CreateLobbyRequest {
  name: string;
}

/**
 * Enter a lobby with a team drafted for it. The server only accepts teams
 * owned by the calling device and created after the lobby opened (no loading
 * pre-existing saved teams), one entry per device per lobby.
 */
export interface EnterLobbyRequest {
  code: string;
  teamSlug: string;
  /** Entrant's name, shown beside the team in standings ("whose is whose"). */
  displayName?: string;
}

export interface LobbyStanding {
  teamSlug: string;
  teamName: string;
  displayName: string | null;
  /** Round-robin head-to-head record within the lobby. */
  wins: number;
  losses: number;
  ovr: number;
}

export interface LobbyResponse {
  code: string;
  name: string;
  createdAt: string;
  /** Set once the creator ends the lobby; entries stay open until then. */
  closedAt: string | null;
  /** "closed" once the creator ends the lobby. */
  status: "open" | "closed";
  /** Top of the standings, crowned only once the lobby is closed. */
  winner: LobbyStanding | null;
  standings: LobbyStanding[]; // sorted: wins desc, then ovr desc
}

export interface LeaderboardEntry {
  rank: number;
  teamSlug: string;
  teamName: string;
  displayName: string | null;
  wins: number;
  losses: number;
  ovr: number;
  /** True when the entry belongs to the requesting device/user ("You"). */
  viewer?: boolean;
}

export interface LeaderboardResponse {
  scope: "global" | "weekly";
  snapshotVersion: string;
  entries: LeaderboardEntry[];
}

export type ExplainRequest =
  | { kind: "team"; teamSlug: string }
  | { kind: "matchup"; matchupId: string }
  /** Unsaved draft straight from /sim: the server re-runs the engine on the
   *  roster (server-authoritative) and explains it like a saved team. */
  | { kind: "draft"; roster: Roster; snapshotVersion: string };
// ExplainResponse is a streamed text response (Vercel AI SDK data stream).
