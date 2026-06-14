/**
 * Pure, replayable state machine for the 82-0 draft game.
 *
 * All randomness is derived from (seed, rngCursor) via a seeded PRNG, so the
 * same seed + the same action sequence always produces the same state. The
 * reducer never touches the DOM, storage, or module state — persistence lives
 * in the provider (game-provider.tsx).
 *
 * The roster shape, round count, and re-spin budget are not hard-coded: a
 * GameMode supplies them, so the same machine drives both Classic (8 players:
 * five starters PG/SG/SF/PF/C + a guard/forward/center bench, 1+1 skips) and
 * the 10-Player beta (five starters + a PG/SG/SF/PF/C bench, 2+2 skips).
 * Players are placed into a slot AT DRAFT TIME — pick a player from the spun
 * pool, then click an open slot they're eligible for. Spins only ever land on
 * pools containing at least one player who fits an open slot, so the draft can
 * always be completed.
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
// Slots & game modes
// ---------------------------------------------------------------------------

/** A slot key is a starter position (PG…C) or a mode-specific bench-slot key. */
export type Slot = string;

export interface BenchSlotDef {
  /** Globally unique key (starter positions are reused as-is; bench keys are
   *  distinct across modes so a slot key alone resolves what it accepts). */
  key: string;
  /** Short label shown under the slot. */
  label: string;
  /** Starter positions this bench slot will take. */
  accepts: readonly Position[];
}

export interface GameMode {
  id: string;
  label: string;
  /** Number of draft rounds = roster size. */
  draftRounds: number;
  teamSkips: number;
  eraSkips: number;
  benchSlots: readonly BenchSlotDef[];
  /** Starter slots then bench slots, in display/iteration order. */
  allSlots: readonly Slot[];
  /** localStorage key — distinct per mode so drafts don't clobber each other. */
  storageKey: string;
  /** Draft- and sim-screen routes for this mode. */
  playPath: string;
  simPath: string;
}

const CLASSIC_BENCH: BenchSlotDef[] = [
  { key: "BG", label: "G", accepts: ["PG", "SG"] },
  { key: "BF", label: "F", accepts: ["SF", "PF"] },
  { key: "BC", label: "C", accepts: ["C"] },
];

/** 10-player beta: a strict positional bench (a second of each position). */
const TEN_BENCH: BenchSlotDef[] = [
  { key: "bPG", label: "PG", accepts: ["PG"] },
  { key: "bSG", label: "SG", accepts: ["SG"] },
  { key: "bSF", label: "SF", accepts: ["SF"] },
  { key: "bPF", label: "PF", accepts: ["PF"] },
  { key: "bC", label: "C", accepts: ["C"] },
];

export const CLASSIC_MODE: GameMode = {
  id: "classic",
  label: "Classic",
  draftRounds: DRAFT_ROUNDS,
  teamSkips: TEAM_SKIPS_PER_GAME,
  eraSkips: ERA_SKIPS_PER_GAME,
  benchSlots: CLASSIC_BENCH,
  allSlots: [...POSITIONS, ...CLASSIC_BENCH.map((b) => b.key)],
  storageKey: "eighty-two-zero/game/v2",
  playPath: "/play",
  simPath: "/sim",
};

export const TEN_MODE: GameMode = {
  id: "ten",
  label: "10-Player",
  draftRounds: 10,
  teamSkips: 1,
  eraSkips: 1,
  benchSlots: TEN_BENCH,
  allSlots: [...POSITIONS, ...TEN_BENCH.map((b) => b.key)],
  storageKey: "eighty-two-zero/game10/v1",
  playPath: "/play10",
  simPath: "/sim10",
};

/** 5-man: just the five starters, no bench. The engine handles an empty bench
 *  (blockAgg falls back to starters-only), so this needs no special-casing. */
export const FIVE_MODE: GameMode = {
  id: "five",
  label: "5-Man",
  draftRounds: 5,
  teamSkips: TEAM_SKIPS_PER_GAME,
  eraSkips: ERA_SKIPS_PER_GAME,
  benchSlots: [],
  allSlots: [...POSITIONS],
  storageKey: "eighty-two-zero/game5/v1",
  playPath: "/play5",
  simPath: "/sim5",
};

export const MODES: Record<string, GameMode> = {
  [CLASSIC_MODE.id]: CLASSIC_MODE,
  [TEN_MODE.id]: TEN_MODE,
  [FIVE_MODE.id]: FIVE_MODE,
};

/** Bench-slot defs across every mode, keyed by their (globally unique) key. */
const BENCH_DEFS: Record<string, BenchSlotDef> = {};
for (const m of Object.values(MODES)) {
  for (const b of m.benchSlots) BENCH_DEFS[b.key] = b;
}

/** Classic bench keys / all slots — kept for back-compat with classic UI. */
export const BENCH_SLOTS = CLASSIC_MODE.benchSlots.map((b) => b.key);
export const ALL_SLOTS: readonly Slot[] = CLASSIC_MODE.allSlots;

/** Slot key → short label, across all modes. */
export const SLOT_LABELS: Record<string, string> = {
  PG: "PG",
  SG: "SG",
  SF: "SF",
  PF: "PF",
  C: "C",
  ...Object.fromEntries(Object.values(BENCH_DEFS).map((b) => [b.key, b.label])),
};

/** Can a player with these listed positions man this slot? Resolves bench
 *  slots from their (mode-independent) key, so it needs no mode context. */
export function slotAccepts(slot: Slot, positions: readonly Position[]): boolean {
  const bench = BENCH_DEFS[slot];
  if (bench) return positions.some((p) => bench.accepts.includes(p));
  return positions.includes(slot as Position);
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
  /** The mode this context drives (defaults to Classic when absent). */
  mode?: GameMode;
}

export function buildDraftContext(
  snapshot: Snapshot,
  mode: GameMode = CLASSIC_MODE
): DraftContext {
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
  return { pools, slugById, positionsById, snapshotVersion: snapshot.version, mode };
}

const ctxMode = (ctx: DraftContext): GameMode => ctx.mode ?? CLASSIC_MODE;
const stateMode = (state: GameState): GameMode =>
  MODES[state.modeId] ?? CLASSIC_MODE;

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

export interface GameState {
  /** Which GameMode this draft belongs to. */
  modeId: string;
  snapshotVersion: string;
  seed: number;
  /** Count of randomness-consuming actions taken so far. */
  rngCursor: number;
  status: GameStatus;
  excludedDecades: Decade[];
  /** 1-based, up to the mode's draftRounds. */
  round: number;
  spin: SpinResult | null;
  /** Increments on every (re)spin — lets the UI key reel animations. */
  spinNonce: number;
  teamSkipsLeft: number;
  eraSkipsLeft: number;
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
  /** Lobby code this draft will be entered into on save, if any. */
  lobbyCode: string | null;
}

export type GameAction =
  | {
      type: "NEW_GAME";
      seed: number;
      challengeSlug?: string | null;
      lobbyCode?: string | null;
    }
  | { type: "SPIN" }
  | { type: "SKIP_TEAM" }
  | { type: "SKIP_ERA" }
  | { type: "SELECT_PLAYER"; playerId: string | null }
  | { type: "PLACE"; slot: Slot }
  | { type: "MOVE"; from: Slot; to: Slot }
  /** Detach the draft from its lobby — it continues as a free-play draft.
   *  Re-entering the lobby later requires its link and a fresh draft. */
  | { type: "LEAVE_LOBBY" };

export const comboKey = (c: SpinResult) => `${c.franchiseId}|${c.decade}`;

function emptySlots(mode: GameMode): Record<Slot, string | null> {
  const out: Record<Slot, string | null> = {};
  for (const s of mode.allSlots) out[s] = null;
  return out;
}

// ---------------------------------------------------------------------------
// Derived helpers (exported for UI + tests)
// ---------------------------------------------------------------------------

export function draftedSlugs(state: GameState, ctx: DraftContext): Set<string> {
  return new Set(state.picks.map((id) => ctx.slugById[id]).filter(Boolean));
}

export function openSlots(state: GameState): Slot[] {
  return stateMode(state).allSlots.filter((s) => state.slots[s] === null);
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
  return stateMode(state).allSlots.filter((to) => {
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
  return stateMode(state).allSlots.every((s) => state.slots[s] != null);
}

/**
 * Build the contracts Roster. Bench order follows the mode's benchSlots.
 * For the 10-player beta the bench carries five entries; the engine weights
 * each bench player identically regardless of count, so this stays valid
 * input for teamRating/projectSeason even though it isn't a frozen-schema
 * (8-man) Roster.
 */
export function toRoster(state: GameState): Roster | null {
  if (!rosterComplete(state)) return null;
  const mode = stateMode(state);
  const starters = {} as Record<Position, string>;
  for (const p of POSITIONS) starters[p] = state.slots[p]!;
  return {
    starters,
    bench: mode.benchSlots.map((b) => state.slots[b.key]!),
  };
}

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

export function newGame(
  seed: number,
  ctx: DraftContext,
  challengeSlug: string | null = null,
  lobbyCode: string | null = null
): GameState {
  const mode = ctxMode(ctx);
  const rng = mulberry32(seed >>> 0);
  const base: GameState = {
    modeId: mode.id,
    snapshotVersion: ctx.snapshotVersion,
    seed: seed >>> 0,
    rngCursor: 0,
    status: "draft",
    excludedDecades: [],
    round: 1,
    spin: null,
    spinNonce: 0,
    teamSkipsLeft: mode.teamSkips,
    eraSkipsLeft: mode.eraSkips,
    spunCombos: [],
    picks: [],
    slots: emptySlots(mode),
    selectedPlayerId: null,
    challengeSlug,
    lobbyCode,
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
      return newGame(
        action.seed,
        ctx,
        action.challengeSlug ?? null,
        action.lobbyCode ?? null
      );

    case "LEAVE_LOBBY":
      return state.lobbyCode === null ? state : { ...state, lobbyCode: null };

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
      const rounds = ctxMode(ctx).draftRounds;
      if (state.picks.length >= rounds) return state;
      const playerId = state.selectedPlayerId;
      if (!eligibleSlotsFor(playerId, state, ctx).includes(action.slot)) {
        return state;
      }
      const picks = [...state.picks, playerId];
      const slots = { ...state.slots, [action.slot]: playerId };
      const done = picks.length >= rounds;
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

/** Classic storage key — kept exported for back-compat; per-mode keys live on
 *  the GameMode. */
export const STORAGE_KEY = CLASSIC_MODE.storageKey;

const PersistedSchema = z.object({
  // Optional for saves written before multi-mode support (default Classic).
  modeId: z.string().default(CLASSIC_MODE.id),
  snapshotVersion: z.string(),
  seed: z.number(),
  rngCursor: z.number().int().min(0),
  status: z.enum(["draft", "locked"]),
  excludedDecades: z.array(z.enum(DECADES)),
  round: z.number().int().min(1).max(40),
  spin: z
    .object({ franchiseId: z.string(), decade: z.enum(DECADES) })
    .nullable(),
  spinNonce: z.number().int().min(0),
  teamSkipsLeft: z.number().int().min(0).max(20),
  eraSkipsLeft: z.number().int().min(0).max(20),
  // Optional for saves written before duplicate-combo tracking.
  spunCombos: z.array(z.string()).default([]),
  picks: z.array(z.string()).max(40),
  slots: z.record(z.string(), z.string().nullable()),
  selectedPlayerId: z.string().nullable(),
  // Optional for saves written before challenges / lobbies existed.
  challengeSlug: z.string().nullable().default(null),
  lobbyCode: z.string().nullable().default(null),
});

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Parse a persisted state. Returns null (caller starts a new game) when the
 * payload is malformed, from another snapshot version, from a different mode
 * than this context drives, or references players that no longer exist.
 */
export function deserializeGame(
  raw: string | null,
  ctx: DraftContext
): GameState | null {
  if (!raw) return null;
  try {
    const parsed = PersistedSchema.parse(JSON.parse(raw));
    if (parsed.snapshotVersion !== ctx.snapshotVersion) return null;
    if (parsed.modeId !== ctxMode(ctx).id) return null;
    if (parsed.picks.some((id) => !(id in ctx.slugById))) return null;
    const mode = MODES[parsed.modeId] ?? CLASSIC_MODE;
    const slots = emptySlots(mode);
    for (const s of mode.allSlots) slots[s] = parsed.slots[s] ?? null;
    return { ...parsed, slots };
  } catch {
    return null;
  }
}
