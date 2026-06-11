/**
 * Pure, replayable state machine for the 82-0 draft game.
 *
 * All randomness is derived from (seed, rngCursor) via a seeded PRNG, so the
 * same seed + the same action sequence always produces the same state. The
 * reducer never touches the DOM, storage, or module state — persistence lives
 * in the provider (game-provider.tsx).
 *
 * Roster model (hard requirements): five starter slots PG/SG/SF/PF/C plus
 * three bench slots BG (guard: PG|SG), BF (forward: SF|PF), BC (center).
 * Players are placed into a slot AT DRAFT TIME — pick a player from the spun
 * pool, then click an open slot they're eligible for. Spins only ever land on
 * pools containing at least one player who fits an open slot, so the draft
 * can always be completed.
 */

import { z } from "zod";
import {
  DECADES,
  Decade,
  DRAFT_ROUNDS,
  ERA_SKIPS_PER_GAME,
  EXCLUDED_DECADES_PER_GAME,
  POSITIONS,
  Position,
  Roster,
  Snapshot,
  SpinResult,
  TEAM_SKIPS_PER_GAME,
} from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

export const BENCH_SLOTS = ["BG", "BF", "BC"] as const;
export type BenchSlot = (typeof BENCH_SLOTS)[number];
export type Slot = Position | BenchSlot;
export const ALL_SLOTS: readonly Slot[] = [...POSITIONS, ...BENCH_SLOTS];

export const SLOT_LABELS: Record<Slot, string> = {
  PG: "PG",
  SG: "SG",
  SF: "SF",
  PF: "PF",
  C: "C",
  BG: "G",
  BF: "F",
  BC: "C",
};

/** Starter positions a bench slot accepts. */
const BENCH_ACCEPTS: Record<BenchSlot, readonly Position[]> = {
  BG: ["PG", "SG"],
  BF: ["SF", "PF"],
  BC: ["C"],
};

/** Can a player with these listed positions man this slot? */
export function slotAccepts(slot: Slot, positions: readonly Position[]): boolean {
  if (slot === "BG" || slot === "BF" || slot === "BC") {
    return positions.some((p) => BENCH_ACCEPTS[slot].includes(p));
  }
  return positions.includes(slot);
}

// ---------------------------------------------------------------------------
// Context — static lookup data derived from the snapshot (not part of state)
// ---------------------------------------------------------------------------

export interface DraftContext {
  /** franchiseId → decade → player ids (non-empty pools only). */
  pools: Record<string, Partial<Record<Decade, string[]>>>;
  /** player id → playerSlug, to block drafting the same human twice. */
  slugById: Record<string, string>;
  /** player id → [primary position, ...altPositions]. */
  positionsById: Record<string, Position[]>;
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
  const positionsById: Record<string, Position[]> = {};
  for (const p of snapshot.players) {
    slugById[p.id] = p.playerSlug;
    positionsById[p.id] = [p.position, ...p.altPositions];
  }
  return { pools, slugById, positionsById, snapshotVersion: snapshot.version };
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

export type GameStatus = "draft" | "locked";

/** One roster do-over per game: evict a player, spin fresh, draft a sub. */
export const REPLACES_PER_GAME = 1;

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
  replacesLeft: number;
  /** Every franchise×decade combo the reels have landed on ("fid|decade") —
   *  the same combo never comes up twice in one game. */
  spunCombos: string[];
  /** Drafted player ids in pick order. */
  picks: string[];
  /** The roster being built, one player per slot. */
  slots: Record<Slot, string | null>;
  /** Pool player awaiting slot placement (click player → click slot). */
  selectedPlayerId: string | null;
  /** Saved-team slug this draft is challenging head-to-head, if any. */
  challengeSlug: string | null;
}

export type GameAction =
  | { type: "NEW_GAME"; seed: number; challengeSlug?: string | null }
  | { type: "SPIN" }
  | { type: "SKIP_TEAM" }
  | { type: "SKIP_ERA" }
  | { type: "SELECT_PLAYER"; playerId: string | null }
  | { type: "PLACE"; slot: Slot }
  | { type: "MOVE"; from: Slot; to: Slot }
  | { type: "REPLACE"; slot: Slot };

export const comboKey = (c: SpinResult) => `${c.franchiseId}|${c.decade}`;

const emptySlots = (): Record<Slot, string | null> => ({
  PG: null,
  SG: null,
  SF: null,
  PF: null,
  C: null,
  BG: null,
  BF: null,
  BC: null,
});

// ---------------------------------------------------------------------------
// Derived helpers (exported for UI + tests)
// ---------------------------------------------------------------------------

export function draftedSlugs(state: GameState, ctx: DraftContext): Set<string> {
  return new Set(state.picks.map((id) => ctx.slugById[id]).filter(Boolean));
}

export function openSlots(state: GameState): Slot[] {
  return ALL_SLOTS.filter((s) => state.slots[s] === null);
}

/** Open slots this specific player may fill. */
export function eligibleSlotsFor(
  playerId: string,
  state: GameState,
  ctx: DraftContext
): Slot[] {
  const positions = ctx.positionsById[playerId];
  if (!positions) return [];
  return openSlots(state).filter((slot) => slotAccepts(slot, positions));
}

/**
 * Slots an already-placed player may MOVE to: empty eligible slots, plus
 * occupied eligible slots whose occupant can take the mover's slot (swap).
 */
export function moveTargetsFor(
  from: Slot,
  state: GameState,
  ctx: DraftContext
): Slot[] {
  const moving = state.slots[from];
  const positions = moving ? ctx.positionsById[moving] : undefined;
  if (!positions) return [];
  return ALL_SLOTS.filter((to) => {
    if (to === from || !slotAccepts(to, positions)) return false;
    const occupant = state.slots[to];
    if (!occupant) return true;
    const occupantPositions = ctx.positionsById[occupant];
    return !!occupantPositions && slotAccepts(from, occupantPositions);
  });
}

/** Pool for a combo minus already-drafted humans. */
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

/** Pool members that can actually fill an open slot right now. */
export function draftablePool(
  state: GameState,
  ctx: DraftContext,
  franchiseId: string,
  decade: Decade
): string[] {
  return pickablePool(state, ctx, franchiseId, decade).filter(
    (id) => eligibleSlotsFor(id, state, ctx).length > 0
  );
}

/**
 * All spinnable franchise×decade combos: decade allowed, at least one
 * pickable player who fits an open slot — a spin can never strand the draft —
 * and not already landed on this game. If every draftable combo has been
 * used (pathological), repeats become legal rather than stranding the draft.
 */
export function eligibleCombos(state: GameState, ctx: DraftContext): SpinResult[] {
  const out: SpinResult[] = [];
  for (const franchiseId of Object.keys(ctx.pools)) {
    for (const decade of Object.keys(ctx.pools[franchiseId]) as Decade[]) {
      if (state.excludedDecades.includes(decade)) continue;
      if (draftablePool(state, ctx, franchiseId, decade).length > 0) {
        out.push({ franchiseId, decade });
      }
    }
  }
  const seen = new Set(state.spunCombos);
  const fresh = out.filter((c) => !seen.has(comboKey(c)));
  return fresh.length > 0 ? fresh : out;
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

export function rosterComplete(state: GameState): boolean {
  return ALL_SLOTS.every((s) => state.slots[s] != null);
}

/** Build the contracts Roster. Bench order convention: [BG, BF, BC]. */
export function toRoster(state: GameState): Roster | null {
  if (!rosterComplete(state)) return null;
  const starters = {} as Record<Position, string>;
  for (const p of POSITIONS) starters[p] = state.slots[p]!;
  return {
    starters,
    bench: [state.slots.BG!, state.slots.BF!, state.slots.BC!],
  };
}

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

export function newGame(
  seed: number,
  ctx: DraftContext,
  challengeSlug: string | null = null
): GameState {
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
    replacesLeft: REPLACES_PER_GAME,
    spunCombos: [],
    picks: [],
    slots: emptySlots(),
    selectedPlayerId: null,
    challengeSlug,
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
      return newGame(action.seed, ctx, action.challengeSlug ?? null);

    case "SPIN": {
      if (state.status !== "draft" || state.spin !== null) return state;
      const combos = eligibleCombos(state, ctx);
      if (combos.length === 0) return state;
      const rng = rngFor(state.seed, state.rngCursor);
      const spin = combos[Math.floor(rng() * combos.length)];
      return {
        ...state,
        spin,
        spunCombos: [...state.spunCombos, comboKey(spin)],
        selectedPlayerId: null,
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
        spunCombos: [...state.spunCombos, comboKey(spin)],
        selectedPlayerId: null,
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
        spunCombos: [...state.spunCombos, comboKey(spin)],
        selectedPlayerId: null,
        eraSkipsLeft: state.eraSkipsLeft - 1,
        rngCursor: state.rngCursor + 1,
        spinNonce: state.spinNonce + 1,
      };
    }

    case "SELECT_PLAYER": {
      if (state.status !== "draft" || !state.spin) return state;
      if (action.playerId === null) {
        return state.selectedPlayerId === null
          ? state
          : { ...state, selectedPlayerId: null };
      }
      const pool = draftablePool(
        state,
        ctx,
        state.spin.franchiseId,
        state.spin.decade
      );
      if (!pool.includes(action.playerId)) return state;
      return {
        ...state,
        // Tapping the selected player again deselects.
        selectedPlayerId:
          state.selectedPlayerId === action.playerId ? null : action.playerId,
      };
    }

    case "REPLACE": {
      // Once per game, draft phase only: evict a rostered player, freeing the
      // slot to be re-drafted from a fresh spin.
      if (state.status !== "draft" || state.replacesLeft <= 0) return state;
      const evicted = state.slots[action.slot];
      if (!evicted) return state;
      const picks = state.picks.filter((id) => id !== evicted);
      return {
        ...state,
        replacesLeft: state.replacesLeft - 1,
        picks,
        slots: { ...state.slots, [action.slot]: null },
        selectedPlayerId: null,
        round: picks.length + 1,
      };
    }

    case "MOVE": {
      if (state.status !== "draft") return state;
      if (!moveTargetsFor(action.from, state, ctx).includes(action.to)) {
        return state;
      }
      const moving = state.slots[action.from]!;
      const occupant = state.slots[action.to];
      return {
        ...state,
        slots: { ...state.slots, [action.to]: moving, [action.from]: occupant ?? null },
      };
    }

    case "PLACE": {
      if (state.status !== "draft" || !state.spin || !state.selectedPlayerId) {
        return state;
      }
      if (state.picks.length >= DRAFT_ROUNDS) return state;
      const playerId = state.selectedPlayerId;
      if (!eligibleSlotsFor(playerId, state, ctx).includes(action.slot)) {
        return state;
      }
      const picks = [...state.picks, playerId];
      const slots = { ...state.slots, [action.slot]: playerId };
      const done = picks.length >= DRAFT_ROUNDS;
      return {
        ...state,
        picks,
        slots,
        spin: null,
        selectedPlayerId: null,
        status: done ? "locked" : "draft",
        round: done ? state.round : state.round + 1,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Persistence (serialization only — storage I/O lives in the provider)
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "eighty-two-zero/game/v2";

const SLOT_KEYS = [...POSITIONS, ...BENCH_SLOTS] as [Slot, ...Slot[]];

const PersistedSchema = z.object({
  snapshotVersion: z.string(),
  seed: z.number(),
  rngCursor: z.number().int().min(0),
  status: z.enum(["draft", "locked"]),
  excludedDecades: z.array(z.enum(DECADES)),
  round: z.number().int().min(1).max(DRAFT_ROUNDS),
  spin: z
    .object({ franchiseId: z.string(), decade: z.enum(DECADES) })
    .nullable(),
  spinNonce: z.number().int().min(0),
  teamSkipsLeft: z.number().int().min(0).max(TEAM_SKIPS_PER_GAME),
  eraSkipsLeft: z.number().int().min(0).max(ERA_SKIPS_PER_GAME),
  // Optional for saves written before replace / duplicate-combo tracking.
  replacesLeft: z.number().int().min(0).max(REPLACES_PER_GAME).default(REPLACES_PER_GAME),
  spunCombos: z.array(z.string()).default([]),
  picks: z.array(z.string()).max(DRAFT_ROUNDS),
  slots: z.record(z.enum(SLOT_KEYS), z.string().nullable()),
  selectedPlayerId: z.string().nullable(),
  // Optional for saves written before challenges existed.
  challengeSlug: z.string().nullable().default(null),
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
    const slots = emptySlots();
    for (const s of ALL_SLOTS) slots[s] = parsed.slots[s] ?? null;
    return { ...parsed, slots };
  } catch {
    return null;
  }
}
