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
  AggDir,
  BENCH_BLOCK_W,
  CAT_DIRECTION,
  CAT_WEIGHTS,
  DEF_BASE,
  DEF_SLOPE,
  DEF_WEIGHTS,
  DRTG_DIRECTION,
  GAMMA_DEF,
  GAMMA_OFF,
  GATE_FLOOR_CAP,
  GATE_STEPS,
  GATE_THRESHOLDS,
  MATCHUP_EDGE_SCALE,
  MATCHUP_OVR_BLEND,
  MATCHUP_OVR_SCALE,
  OFF_BASE,
  OFF_SLOPE,
  OFF_WEIGHTS,
  ORTG_DIRECTION,
  OVR_BASE,
  OVR_SLOPE,
  POSITION_PENALTY,
  RATING_BLEND,
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

/**
 * Rank-decay OWA: sort the contributions by direction, weight them γ^0, γ^1,
 * γ^2, …, and normalize. "best" sorts descending — the top contributor drives
 * the result and the rest give diminishing returns (γ→0 is the pure max).
 * "worst" sorts ascending, so the weakest link dominates (γ→0 is the pure
 * min). Monotone non-decreasing in every input (a standard OWA property), so
 * a better player never lowers the team's value in any category.
 */
function dirAgg(values: number[], gamma: number, dir: AggDir): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => (dir === "worst" ? a - b : b - a));
  let num = 0;
  let den = 0;
  let w = 1;
  for (const v of sorted) {
    num += w * v;
    den += w;
    w *= gamma;
  }
  return num / den;
}

/**
 * One quantity's team value: the concave aggregate over the starters blended
 * with a discounted concave aggregate over the bench. Aggregating the two
 * groups separately (rather than ranking all eight together) keeps the rating
 * monotone — no player's improvement can reshuffle the starter/bench weighting
 * against them — while still letting the bench matter less than the five.
 */
function blockAgg(
  starterVals: number[],
  benchVals: number[],
  gamma: number,
  dir: AggDir
): number {
  const s = dirAgg(starterVals, gamma, dir);
  if (benchVals.length === 0) return s;
  const b = dirAgg(benchVals, gamma, dir);
  return (s + BENCH_BLOCK_W * b) / (1 + BENCH_BLOCK_W);
}

function teamRating(
  roster: Roster,
  players: Map<string, PlayerStatLine>,
  baselines: EraBaselines
): TeamRating {
  const starters: { adj: AdjustedStats; factor: number }[] = [];
  for (const slot of POSITIONS) {
    const id = roster.starters[slot];
    const p = id ? players.get(id) : undefined;
    if (!p) continue;
    starters.push({ adj: eraAdjust(p, baselines), factor: positionFactor(slot, p) });
  }
  const bench: { adj: AdjustedStats }[] = [];
  for (const id of roster.bench) {
    const p = players.get(id);
    if (!p) continue;
    bench.push({ adj: eraAdjust(p, baselines) });
  }

  // Concave team category profile: offense leans toward its best contributor
  // (star-driven), defense/ball-security toward its weakest link. This is
  // where redundancy gets taxed and complementarity (plus two-way balance)
  // gets rewarded — no flat averaging.
  const aggCat = (cat: NineCat): number => {
    const dir = CAT_DIRECTION[cat];
    const gamma = dir === "best" ? GAMMA_OFF : GAMMA_DEF;
    return blockAgg(
      starters.map((e) => e.adj[cat]),
      bench.map((e) => e.adj[cat]),
      gamma,
      dir
    );
  };
  const catProfile = Object.fromEntries(
    NINE_CATS.map((c) => [c, aggCat(c)])
  ) as Record<NineCat, number>;

  const ortgAgg = blockAgg(
    starters.map((e) => e.adj.ortg),
    bench.map((e) => e.adj.ortg),
    GAMMA_OFF,
    ORTG_DIRECTION
  );
  const drtgAgg = blockAgg(
    starters.map((e) => e.adj.drtg),
    bench.map((e) => e.adj.drtg),
    GAMMA_DEF,
    DRTG_DIRECTION
  );

  // Team strength composite: the concave 9-cat blend plus the ratings blend.
  let catComposite = 0;
  for (const cat of NINE_CATS) catComposite += CAT_WEIGHTS[cat] * catProfile[cat];
  const ratingComposite = 0.5 * ortgAgg + 0.5 * drtgAgg;
  const teamComposite =
    (1 - RATING_BLEND) * catComposite + RATING_BLEND * ratingComposite;

  // Out-of-position penalty rides in as a monotone multiplier (mean starter
  // factor): it degrades the lineup's overall impact, not the literal stats.
  const posMult =
    starters.length > 0
      ? starters.reduce((s, e) => s + e.factor, 0) / starters.length
      : 1;

  const offZ =
    OFF_WEIGHTS.pts * catProfile.pts +
    OFF_WEIGHTS.ast * catProfile.ast +
    OFF_WEIGHTS.fgPct * catProfile.fgPct +
    OFF_WEIGHTS.ftPct * catProfile.ftPct +
    OFF_WEIGHTS.tpm * catProfile.tpm +
    OFF_WEIGHTS.ortg * ortgAgg;
  const defZ =
    DEF_WEIGHTS.reb * catProfile.reb +
    DEF_WEIGHTS.stl * catProfile.stl +
    DEF_WEIGHTS.blk * catProfile.blk +
    DEF_WEIGHTS.drtg * drtgAgg;

  return {
    ovr: round1(clamp(OVR_BASE + OVR_SLOPE * posMult * teamComposite, 0, OVR_MAX)),
    offRating: round1(clamp(OFF_BASE + OFF_SLOPE * offZ, 0, 100)),
    defRating: round1(clamp(DEF_BASE + DEF_SLOPE * defZ, 0, 100)),
    catProfile,
  };
}

/** Win cap implied by one category's team z (thresholds are per cat). */
export function gateCapFor(cat: NineCat, teamZ: number): number {
  const threshold = GATE_THRESHOLDS[cat];
  for (const [offset, cap] of GATE_STEPS) {
    if (teamZ >= threshold + offset) return cap;
  }
  return GATE_FLOOR_CAP;
}

function projectSeason(rating: TeamRating): SeasonResult {
  let winCap = SEASON_GAMES;
  let gatedCategory: NineCat | null = null;
  let gatedMargin = Infinity;
  for (const cat of NINE_CATS) {
    const z = rating.catProfile[cat];
    const cap = gateCapFor(cat, z);
    const margin = z - GATE_THRESHOLDS[cat];
    if (cap < winCap || (cap === winCap && cap < SEASON_GAMES && margin < gatedMargin)) {
      winCap = cap;
      gatedCategory = cat;
      gatedMargin = margin;
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
