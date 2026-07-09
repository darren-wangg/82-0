/**
 * FROZEN CONTRACTS — runtime zod schemas for the shapes in contracts.ts.
 *
 * Split from contracts.ts so that client bundles importing contract types and
 * constants never pull zod (~85 KB gz) along: this module is imported only by
 * server code (API routes, the ETL, tests). Client code imports contracts.ts,
 * which is zod-free. The same freeze rule applies to both files: build to the
 * contract, never edit it during parallel-task waves.
 *
 * Every schema is pinned to its hand-written contracts.ts type by the
 * compile-time parity assertions at the bottom — if a schema and its type
 * drift, `tsc --noEmit` fails.
 */

import { z } from "zod";
import {
  BENCH_COUNT,
  DECADES,
  POSITIONS,
  type EraBaseline,
  type ExplainRequest,
  type Franchise,
  type NineCatLine,
  type PlayerStatLine,
  type Roster,
  type Snapshot,
  type CreateLobbyRequest,
  type CreateMatchupRequest,
  type EnterLobbyRequest,
  type SaveTeamRequest,
} from "./contracts";

// ---------------------------------------------------------------------------
// Snapshot (data pipeline output, game input)
// ---------------------------------------------------------------------------

export const NineCatLineSchema = z.object({
  pts: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  /** 0–1 fraction, e.g. 0.509 */
  fgPct: z.number(),
  /** 0–1 fraction */
  ftPct: z.number(),
  /** made threes per game */
  tpm: z.number(),
  /** turnovers per game */
  tov: z.number(),
});

export const PlayerStatLineSchema = z.object({
  /** Stable id: `${bbrefSlug}-${franchiseId}-${decade}` */
  id: z.string(),
  /** Basketball-Reference style slug, e.g. "chambwi01" */
  playerSlug: z.string(),
  name: z.string(),
  /** Curated nickname; absent → UI falls back to last name. */
  nickname: z.string().optional(),
  /** stats.nba.com person id for headshot CDN; absent → silhouette. */
  nbaPlayerId: z.number().optional(),
  franchiseId: z.string(),
  decade: z.enum(DECADES),
  /** Season label of the peak season used, e.g. "1961-62". */
  peakSeason: z.string(),
  /** Primary listed position; engine applies out-of-position penalty off this. */
  position: z.enum(POSITIONS),
  /** Secondary positions playable without penalty. */
  altPositions: z.array(z.enum(POSITIONS)).default([]),
  stats: NineCatLineSchema,
  /** Offensive rating (points produced per 100 possessions). */
  ortg: z.number(),
  /** Defensive rating (points allowed per 100 possessions; lower is better). */
  drtg: z.number(),
  /** Cats whose values are estimates (pre-1974 stl/blk/tov, pre-1980 tpm, ratings). */
  estimatedCats: z.array(z.string()).default([]),
});

export const FranchiseSchema = z.object({
  /** Canonical modern id, e.g. "GSW" (covers Philadelphia/SF Warriors history). */
  id: z.string(),
  name: z.string(),
  /** Decades in which the franchise has a draftable pool. */
  activeDecades: z.array(z.enum(DECADES)),
});

/** Per-decade league mean and standard deviation for each cat + ratings. */
export const EraBaselineSchema = z.object({
  decade: z.enum(DECADES),
  mean: NineCatLineSchema.extend({ ortg: z.number(), drtg: z.number() }),
  sd: NineCatLineSchema.extend({ ortg: z.number(), drtg: z.number() }),
});

export const SnapshotSchema = z.object({
  version: z.string(), // e.g. "v1"
  generatedAt: z.string(),
  attribution: z.string(),
  franchises: z.array(FranchiseSchema),
  baselines: z.array(EraBaselineSchema),
  players: z.array(PlayerStatLineSchema),
  /** franchiseId → decade → player ids (indexes into `players`). */
  pools: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
});

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export const RosterSchema = z.object({
  /** Position → PlayerStatLine id. All five required to simulate. */
  starters: z.record(z.enum(POSITIONS), z.string()),
  /** Exactly BENCH_COUNT ids. */
  bench: z.array(z.string()).length(BENCH_COUNT),
});

// ---------------------------------------------------------------------------
// API route payloads
// ---------------------------------------------------------------------------

export const SaveTeamRequestSchema = z.object({
  teamName: z.string().min(1).max(40),
  roster: RosterSchema,
  snapshotVersion: z.string(),
});

export const CreateMatchupRequestSchema = z.object({
  teamSlugA: z.string(),
  teamSlugB: z.string(),
});

export const CreateLobbyRequestSchema = z.object({
  name: z.string().min(1).max(40),
});

/**
 * Enter a lobby with a team drafted for it. The server only accepts teams
 * owned by the calling device and created after the lobby opened (no loading
 * pre-existing saved teams), one entry per device per lobby.
 */
export const EnterLobbyRequestSchema = z.object({
  code: z.string(),
  teamSlug: z.string(),
  /** Entrant's name, shown beside the team in standings ("whose is whose"). */
  displayName: z.string().trim().min(1).max(24).optional(),
});

export const ExplainRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("team"), teamSlug: z.string() }),
  z.object({ kind: z.literal("matchup"), matchupId: z.string() }),
  /** Unsaved draft straight from /sim: the server re-runs the engine on the
   *  roster (server-authoritative) and explains it like a saved team. */
  z.object({
    kind: z.literal("draft"),
    roster: RosterSchema,
    snapshotVersion: z.string(),
  }),
]);

// ---------------------------------------------------------------------------
// Compile-time schema ⇄ type parity (zero runtime cost). These fail
// `tsc --noEmit` if a schema's inferred output stops matching the
// hand-written contract type.
// ---------------------------------------------------------------------------

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B
  ? 1
  : 2)
  ? true
  : false;
type Assert<T extends true> = T;

export type ContractSchemaParity = [
  Assert<Equal<z.infer<typeof NineCatLineSchema>, NineCatLine>>,
  Assert<Equal<z.infer<typeof PlayerStatLineSchema>, PlayerStatLine>>,
  Assert<Equal<z.infer<typeof FranchiseSchema>, Franchise>>,
  Assert<Equal<z.infer<typeof EraBaselineSchema>, EraBaseline>>,
  Assert<Equal<z.infer<typeof SnapshotSchema>, Snapshot>>,
  Assert<Equal<z.infer<typeof RosterSchema>, Roster>>,
  Assert<Equal<z.infer<typeof SaveTeamRequestSchema>, SaveTeamRequest>>,
  Assert<Equal<z.infer<typeof CreateMatchupRequestSchema>, CreateMatchupRequest>>,
  Assert<Equal<z.infer<typeof CreateLobbyRequestSchema>, CreateLobbyRequest>>,
  Assert<Equal<z.infer<typeof EnterLobbyRequestSchema>, EnterLobbyRequest>>,
  Assert<Equal<z.infer<typeof ExplainRequestSchema>, ExplainRequest>>,
];
