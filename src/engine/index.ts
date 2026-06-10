/**
 * 82-0 Plus simulation engine (Wave 1B). Implements the frozen Engine
 * contract from src/lib/contracts.ts. Pure TypeScript, zero dependencies,
 * fully deterministic (matchups use a seeded mulberry32 PRNG).
 *
 * Pipeline: eraAdjust (per-decade z-scores, negative cats sign-flipped,
 * clamped to ±Z_CLAMP) → playerScore (weighted 9-cat composite blended with
 * ortg/drtg) → teamRating (starters full weight with out-of-position
 * penalties, bench at BENCH_WEIGHT) → projectSeason (win curve capped by
 * per-category gates) / simulateMatchup (logistic OVR + category-edge blend,
 * seeded best-of-7).
 */

import {
  AdjustedStats,
  BENCH_WEIGHT,
  CatEdge,
  Engine,
  EraBaselines,
  MatchupResult,
  NEGATIVE_CATS,
  NINE_CATS,
  NineCat,
  OVR_MAX,
  PlayerStatLine,
  Position,
  POSITIONS,
  Roster,
  SEASON_GAMES,
  SeasonResult,
  TeamRating,
} from "@/lib/contracts";
import {
  CAT_WEIGHTS,
  DEF_WEIGHTS,
  GATE_FLOOR_CAP,
  GATE_TABLE,
  MATCHUP_EDGE_SCALE,
  MATCHUP_OVR_BLEND,
  MATCHUP_OVR_SCALE,
  OFF_WEIGHTS,
  OVR_BASE,
  OVR_SLOPE,
  POSITION_PENALTY,
  RATING_BLEND,
  SUBRATING_SLOPE,
  WIN_CURVE_EXP,
  Z_CLAMP,
} from "./constants";
import { mulberry32 } from "./rng";

export * from "./constants";
export { mulberry32 } from "./rng";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const clampZ = (z: number) => clamp(z, -Z_CLAMP, Z_CLAMP);

const round1 = (v: number) => Math.round(v * 10) / 10;

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

const POS_INDEX: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

/**
 * Multiplier for a player slotted at `slot`. 1.0 when the slot is the primary
 * or an alt position; otherwise penalized by positional distance (PG↔SG mild,
 * PG↔C harsh).
 */
export function positionFactor(slot: Position, player: PlayerStatLine): number {
  const eligible: Position[] = [player.position, ...player.altPositions];
  let dist = POSITIONS.length - 1;
  for (const pos of eligible) {
    dist = Math.min(dist, Math.abs(POS_INDEX[slot] - POS_INDEX[pos]));
  }
  return POSITION_PENALTY[Math.min(dist, POSITION_PENALTY.length - 1)];
}

function eraAdjust(p: PlayerStatLine, baselines: EraBaselines): AdjustedStats {
  const b = baselines[p.decade];
  const out = {} as AdjustedStats;
  for (const cat of NINE_CATS) {
    const z = (p.stats[cat] - b.mean[cat]) / (b.sd[cat] || 1);
    out[cat] = clampZ(NEGATIVE_CATS.includes(cat) ? -z : z);
  }
  out.ortg = clampZ((p.ortg - b.mean.ortg) / (b.sd.ortg || 1));
  // drtg: lower is better, so flip the sign like the negative cats.
  out.drtg = clampZ(-(p.drtg - b.mean.drtg) / (b.sd.drtg || 1));
  return out;
}

function playerScore(adj: AdjustedStats): number {
  let cats = 0;
  for (const cat of NINE_CATS) cats += CAT_WEIGHTS[cat] * adj[cat];
  const ratings = 0.5 * adj.ortg + 0.5 * adj.drtg;
  return (1 - RATING_BLEND) * cats + RATING_BLEND * ratings;
}

function teamRating(
  roster: Roster,
  players: Map<string, PlayerStatLine>,
  baselines: EraBaselines
): TeamRating {
  interface Entry {
    adj: AdjustedStats;
    /** Position factor (1.0 for bench — no slot to be out of). */
    factor: number;
    /** Starter = 1, bench = BENCH_WEIGHT. */
    weight: number;
  }
  const entries: Entry[] = [];
  for (const slot of POSITIONS) {
    const id = roster.starters[slot];
    const p = id ? players.get(id) : undefined;
    if (!p) continue;
    entries.push({ adj: eraAdjust(p, baselines), factor: positionFactor(slot, p), weight: 1 });
  }
  for (const id of roster.bench) {
    const p = players.get(id);
    if (!p) continue;
    entries.push({ adj: eraAdjust(p, baselines), factor: 1, weight: BENCH_WEIGHT });
  }

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0) || 1;

  // Scalar team strength: position penalty applies only here (it degrades a
  // player's overall impact, not the literal stats they produce).
  let scoreSum = 0;
  for (const e of entries) scoreSum += playerScore(e.adj) * e.factor * e.weight;
  const avgScore = scoreSum / totalWeight;

  // Team category profile: weighted-average z per cat (and ratings for the
  // sub-rating composites below).
  const catProfile = Object.fromEntries(NINE_CATS.map((c) => [c, 0])) as Record<
    NineCat,
    number
  >;
  let ortgAvg = 0;
  let drtgAvg = 0;
  for (const e of entries) {
    for (const cat of NINE_CATS) catProfile[cat] += e.adj[cat] * e.weight;
    ortgAvg += e.adj.ortg * e.weight;
    drtgAvg += e.adj.drtg * e.weight;
  }
  for (const cat of NINE_CATS) catProfile[cat] /= totalWeight;
  ortgAvg /= totalWeight;
  drtgAvg /= totalWeight;

  const offZ =
    OFF_WEIGHTS.pts * catProfile.pts +
    OFF_WEIGHTS.ast * catProfile.ast +
    OFF_WEIGHTS.fgPct * catProfile.fgPct +
    OFF_WEIGHTS.ftPct * catProfile.ftPct +
    OFF_WEIGHTS.tpm * catProfile.tpm +
    OFF_WEIGHTS.ortg * ortgAvg;
  const defZ =
    DEF_WEIGHTS.reb * catProfile.reb +
    DEF_WEIGHTS.stl * catProfile.stl +
    DEF_WEIGHTS.blk * catProfile.blk +
    DEF_WEIGHTS.drtg * drtgAvg;

  return {
    ovr: round1(clamp(OVR_BASE + OVR_SLOPE * avgScore, 0, OVR_MAX)),
    offRating: round1(clamp(50 + SUBRATING_SLOPE * offZ, 0, 100)),
    defRating: round1(clamp(50 + SUBRATING_SLOPE * defZ, 0, 100)),
    catProfile,
  };
}

/** Win cap implied by one category's team z. */
export function gateCapFor(teamZ: number): number {
  for (const [minZ, cap] of GATE_TABLE) {
    if (teamZ >= minZ) return cap;
  }
  return GATE_FLOOR_CAP;
}

function projectSeason(rating: TeamRating): SeasonResult {
  let winCap = SEASON_GAMES;
  let gatedCategory: NineCat | null = null;
  let gatedZ = Infinity;
  for (const cat of NINE_CATS) {
    const z = rating.catProfile[cat];
    const cap = gateCapFor(z);
    if (cap < winCap || (cap === winCap && cap < SEASON_GAMES && z < gatedZ)) {
      winCap = cap;
      gatedCategory = cat;
      gatedZ = z;
    }
  }
  const curve = Math.round(
    SEASON_GAMES * Math.pow(clamp(rating.ovr, 0, OVR_MAX) / OVR_MAX, WIN_CURVE_EXP)
  );
  const wins = clamp(Math.min(curve, winCap), 0, SEASON_GAMES);
  return {
    wins,
    losses: SEASON_GAMES - wins,
    ovr: rating.ovr,
    gatedCategory,
    winCap,
  };
}

/** Per-game win probability for team A: logistic OVR gap blended with the
 *  weighted category-edge sum. Exposed for tests/AI explanations. */
export function gameWinProbability(a: TeamRating, b: TeamRating): number {
  const pOvr = logistic((a.ovr - b.ovr) / MATCHUP_OVR_SCALE);
  let edgeSum = 0;
  for (const cat of NINE_CATS) {
    edgeSum += CAT_WEIGHTS[cat] * (a.catProfile[cat] - b.catProfile[cat]);
  }
  const pEdge = logistic(edgeSum / MATCHUP_EDGE_SCALE);
  return MATCHUP_OVR_BLEND * pOvr + (1 - MATCHUP_OVR_BLEND) * pEdge;
}

function simulateMatchup(a: TeamRating, b: TeamRating, seed: number): MatchupResult {
  const rand = mulberry32(seed);
  const pGameA = gameWinProbability(a, b);
  let aWins = 0;
  let bWins = 0;
  while (aWins < 4 && bWins < 4) {
    if (rand() < pGameA) aWins++;
    else bWins++;
  }
  const catBreakdown: CatEdge[] = NINE_CATS.map((cat) => ({
    cat,
    teamA: a.catProfile[cat],
    teamB: b.catProfile[cat],
    edge: a.catProfile[cat] - b.catProfile[cat],
  }));
  return {
    winner: aWins > bWins ? "A" : "B",
    seriesScore: [aWins, bWins],
    pGameA,
    catBreakdown,
    seed,
  };
}

export const engine: Engine = {
  eraAdjust,
  playerScore,
  teamRating,
  projectSeason,
  simulateMatchup,
};
