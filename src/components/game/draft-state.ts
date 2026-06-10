/**
 * Pure, replayable state machine for the 82-0 draft game.
 *
 * All randomness is derived from (seed, rngCursor) via a seeded PRNG, so the
 * same seed + the same action sequence always produces the same state. The
 * reducer never touches the DOM, storage, or module state — persistence lives
 * in the provider (game-provider.tsx).
 */

import { z } from "zod";
import {
  BENCH_COUNT,
  DECADES,
  Decade,
  DRAFT_ROUNDS,
  ERA_SKIPS_PER_GAME,
  EXCLUDED_DECADES_PER_GAME,
  POSITIONS,
  Position,
  PlayerStatLine,
  Roster,
  Snapshot,
  SpinResult,
  TEAM_SKIPS_PER_GAME,
} from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Context — static lookup data derived from the snapshot (not part of state)
// ---------------------------------------------------------------------------

export interface DraftContext {
  /** franchiseId → decade → player ids (non-empty pools only). */
  pools: Record<string, Partial<Record<Decade, string[]>>>;
  /** player id → playerSlug, to block drafting the same human twice. */
  slugById: Record<string, string>;
  snapshotVersion: string;
}

export function buildDraftContext(snapshot: Snapshot): DraftContext {
  const pools: DraftContext["pools"] = {};
  for (const [fid, byDecade] of Object.entries(snapshot.pools)) {
    for (const [decade, ids] of Object.entries(byDecade)) {
      if (!ids || ids.length === 0) continue;
      (pools[fid] ??= {})[decade as Decade] = ids;
    }
  }
  const slugById: Record<string, string> = {};
  for (const p of snapshot.players) slugById[p.id] = p.playerSlug;
  return { pools, slugById, snapshotVersion: snapshot.version };
}

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decorrelated stream for the Nth randomness-consuming action. */
function rngFor(seed: number, cursor: number): () => number {
  return mulberry32((seed ^ Math.imul(cursor + 1, 0x9e3779b9)) >>> 0);
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// State & actions
// ---------------------------------------------------------------------------

export type GameStatus = "draft" | "lineup" | "locked";

export interface GameState {
  snapshotVersion: string;
  seed: number;
  /** Count of randomness-consuming actions taken so far. */
  rngCursor: number;
  status: GameStatus;
  excludedDecades: Decade[];
  /** 1-based, up to DRAFT_ROUNDS. */
  round: number;
  spin: SpinResult | null;
  /** Increments on every (re)spin — lets the UI key reel animations. */
  spinNonce: number;
  teamSkipsLeft: number;
  eraSkipsLeft: number;
  /** Drafted player ids in pick order. */
  picks: string[];
  starters: Record<Position, string | null>;
  bench: (string | null)[];
}

export type AssignTarget =
  | { kind: "starter"; position: Position }
  | { kind: "bench"; index: number }
  | { kind: "unassigned" };

export type GameAction =
  | { type: "NEW_GAME"; seed: number }
  | { type: "SPIN" }
  | { type: "SKIP_TEAM" }
  | { type: "SKIP_ERA" }
  | { type: "PICK"; playerId: string }
  | { type: "ASSIGN"; playerId: string; target: AssignTarget }
  | { type: "LOCK" };

const emptyStarters = (): Record<Position, string | null> => ({
  PG: null,
  SG: null,
  SF: null,
  PF: null,
  C: null,
});

// ---------------------------------------------------------------------------
// Derived helpers (exported for UI + tests)
// ---------------------------------------------------------------------------

export function draftedSlugs(state: GameState, ctx: DraftContext): Set<string> {
  return new Set(state.picks.map((id) => ctx.slugById[id]).filter(Boolean));
}

/** Pool for a combo minus players whose human is already on the roster. */
export function pickablePool(
  state: GameState,
  ctx: DraftContext,
  franchiseId: string,
  decade: Decade
): string[] {
  const taken = draftedSlugs(state, ctx);
  return (ctx.pools[franchiseId]?.[decade] ?? []).filter(
    (id) => !taken.has(ctx.slugById[id])
  );
}

/** All spinnable franchise×decade combos: decade allowed, ≥1 pickable player. */
export function eligibleCombos(state: GameState, ctx: DraftContext): SpinResult[] {
  const out: SpinResult[] = [];
  for (const franchiseId of Object.keys(ctx.pools)) {
    for (const decade of Object.keys(ctx.pools[franchiseId]) as Decade[]) {
      if (state.excludedDecades.includes(decade)) continue;
      if (pickablePool(state, ctx, franchiseId, decade).length > 0) {
        out.push({ franchiseId, decade });
      }
    }
  }
  return out;
}

function teamSkipCandidates(state: GameState, ctx: DraftContext): SpinResult[] {
  if (!state.spin) return [];
  const { franchiseId, decade } = state.spin;
  return eligibleCombos(state, ctx).filter(
    (c) => c.decade === decade && c.franchiseId !== franchiseId
  );
}

function eraSkipCandidates(state: GameState, ctx: DraftContext): SpinResult[] {
  if (!state.spin) return [];
  const { franchiseId, decade } = state.spin;
  return eligibleCombos(state, ctx).filter(
    (c) => c.franchiseId === franchiseId && c.decade !== decade
  );
}

export function canSkipTeam(state: GameState, ctx: DraftContext): boolean {
  return state.teamSkipsLeft > 0 && teamSkipCandidates(state, ctx).length > 0;
}

export function canSkipEra(state: GameState, ctx: DraftContext): boolean {
  return state.eraSkipsLeft > 0 && eraSkipCandidates(state, ctx).length > 0;
}

export function locationOf(state: GameState, playerId: string): AssignTarget {
  for (const pos of POSITIONS) {
    if (state.starters[pos] === playerId) return { kind: "starter", position: pos };
  }
  const index = state.bench.indexOf(playerId);
  if (index >= 0) return { kind: "bench", index };
  return { kind: "unassigned" };
}

function occupantAt(state: GameState, target: AssignTarget): string | null {
  if (target.kind === "starter") return state.starters[target.position];
  if (target.kind === "bench") return state.bench[target.index] ?? null;
  return null;
}

export function unassignedPicks(state: GameState): string[] {
  const placed = new Set<string>([
    ...Object.values(state.starters).filter((v): v is string => v != null),
    ...state.bench.filter((v): v is string => v != null),
  ]);
  return state.picks.filter((id) => !placed.has(id));
}

export function lineupComplete(state: GameState): boolean {
  return (
    POSITIONS.every((p) => state.starters[p] != null) &&
    state.bench.length === BENCH_COUNT &&
    state.bench.every((b) => b != null)
  );
}

/** Build the contracts Roster once the lineup is complete. */
export function toRoster(state: GameState): Roster | null {
  if (!lineupComplete(state)) return null;
  const starters = {} as Record<Position, string>;
  for (const p of POSITIONS) starters[p] = state.starters[p]!;
  return { starters, bench: state.bench as string[] };
}

/** True when assigning this player to the position would be out of position. */
export function isOutOfPosition(player: PlayerStatLine, position: Position): boolean {
  return player.position !== position && !player.altPositions.includes(position);
}

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

export function newGame(seed: number, ctx: DraftContext): GameState {
  const rng = mulberry32(seed >>> 0);
  const base: GameState = {
    snapshotVersion: ctx.snapshotVersion,
    seed: seed >>> 0,
    rngCursor: 0,
    status: "draft",
    excludedDecades: [],
    round: 1,
    spin: null,
    spinNonce: 0,
    teamSkipsLeft: TEAM_SKIPS_PER_GAME,
    eraSkipsLeft: ERA_SKIPS_PER_GAME,
    picks: [],
    starters: emptyStarters(),
    bench: Array(BENCH_COUNT).fill(null),
  };
  // Exclude decades for the whole game; retry (deterministically) in the
  // unlikely case an exclusion set leaves no spinnable combos.
  for (let attempt = 0; attempt < 64; attempt++) {
    const excluded = shuffled(DECADES, rng).slice(0, EXCLUDED_DECADES_PER_GAME);
    const candidate = { ...base, excludedDecades: excluded };
    if (eligibleCombos(candidate, ctx).length > 0) return candidate;
  }
  return base; // pathological snapshot: play with no exclusions
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function gameReducer(
  state: GameState,
  action: GameAction,
  ctx: DraftContext
): GameState {
  switch (action.type) {
    case "NEW_GAME":
      return newGame(action.seed, ctx);

    case "SPIN": {
      if (state.status !== "draft" || state.spin !== null) return state;
      const combos = eligibleCombos(state, ctx);
      if (combos.length === 0) return state;
      const rng = rngFor(state.seed, state.rngCursor);
      const spin = combos[Math.floor(rng() * combos.length)];
      return {
        ...state,
        spin,
        rngCursor: state.rngCursor + 1,
        spinNonce: state.spinNonce + 1,
      };
    }

    case "SKIP_TEAM": {
      if (state.status !== "draft" || !state.spin || state.teamSkipsLeft <= 0) {
        return state;
      }
      const candidates = teamSkipCandidates(state, ctx);
      if (candidates.length === 0) return state;
      const rng = rngFor(state.seed, state.rngCursor);
      const spin = candidates[Math.floor(rng() * candidates.length)];
      return {
        ...state,
        spin,
        teamSkipsLeft: state.teamSkipsLeft - 1,
        rngCursor: state.rngCursor + 1,
        spinNonce: state.spinNonce + 1,
      };
    }

    case "SKIP_ERA": {
      if (state.status !== "draft" || !state.spin || state.eraSkipsLeft <= 0) {
        return state;
      }
      const candidates = eraSkipCandidates(state, ctx);
      if (candidates.length === 0) return state;
      const rng = rngFor(state.seed, state.rngCursor);
      const spin = candidates[Math.floor(rng() * candidates.length)];
      return {
        ...state,
        spin,
        eraSkipsLeft: state.eraSkipsLeft - 1,
        rngCursor: state.rngCursor + 1,
        spinNonce: state.spinNonce + 1,
      };
    }

    case "PICK": {
      if (state.status !== "draft" || !state.spin) return state;
      if (state.picks.length >= DRAFT_ROUNDS) return state;
      const pool = pickablePool(
        state,
        ctx,
        state.spin.franchiseId,
        state.spin.decade
      );
      if (!pool.includes(action.playerId)) return state;
      const picks = [...state.picks, action.playerId];
      if (picks.length >= DRAFT_ROUNDS) {
        return { ...state, picks, spin: null, status: "lineup" };
      }
      return { ...state, picks, spin: null, round: state.round + 1 };
    }

    case "ASSIGN": {
      if (state.status !== "lineup") return state;
      if (!state.picks.includes(action.playerId)) return state;
      const { target } = action;
      if (target.kind === "bench" && (target.index < 0 || target.index >= BENCH_COUNT)) {
        return state;
      }
      const from = locationOf(state, action.playerId);
      if (JSON.stringify(from) === JSON.stringify(target)) return state;
      const displaced = occupantAt(state, target);

      const starters = { ...state.starters };
      const bench = [...state.bench];
      const set = (slot: AssignTarget, id: string | null) => {
        if (slot.kind === "starter") starters[slot.position] = id;
        else if (slot.kind === "bench") bench[slot.index] = id;
      };
      set(from, null);
      set(target, action.playerId);
      // Swap: the displaced player takes the moved player's old slot (or
      // becomes unassigned when the moved player came from the pool).
      if (displaced && displaced !== action.playerId) set(from, displaced);
      return { ...state, starters, bench };
    }

    case "LOCK": {
      if (state.status !== "lineup" || !lineupComplete(state)) return state;
      return { ...state, status: "locked" };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Persistence (serialization only — storage I/O lives in the provider)
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "eighty-two-zero/game/v1";

const PersistedSchema = z.object({
  snapshotVersion: z.string(),
  seed: z.number(),
  rngCursor: z.number().int().min(0),
  status: z.enum(["draft", "lineup", "locked"]),
  excludedDecades: z.array(z.enum(DECADES)),
  round: z.number().int().min(1).max(DRAFT_ROUNDS),
  spin: z
    .object({ franchiseId: z.string(), decade: z.enum(DECADES) })
    .nullable(),
  spinNonce: z.number().int().min(0),
  teamSkipsLeft: z.number().int().min(0).max(TEAM_SKIPS_PER_GAME),
  eraSkipsLeft: z.number().int().min(0).max(ERA_SKIPS_PER_GAME),
  picks: z.array(z.string()).max(DRAFT_ROUNDS),
  starters: z.record(z.enum(POSITIONS), z.string().nullable()),
  bench: z.array(z.string().nullable()).length(BENCH_COUNT),
});

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Parse a persisted state. Returns null (caller starts a new game) when the
 * payload is malformed, from another snapshot version, or references players
 * that no longer exist.
 */
export function deserializeGame(
  raw: string | null,
  ctx: DraftContext
): GameState | null {
  if (!raw) return null;
  try {
    const parsed = PersistedSchema.parse(JSON.parse(raw));
    if (parsed.snapshotVersion !== ctx.snapshotVersion) return null;
    if (parsed.picks.some((id) => !(id in ctx.slugById))) return null;
    const starters = emptyStarters();
    for (const p of POSITIONS) starters[p] = parsed.starters[p] ?? null;
    return { ...parsed, starters };
  } catch {
    return null;
  }
}
