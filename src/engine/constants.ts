/**
 * Tuning constants for the 82-0 Plus simulation engine.
 *
 * Calibrated against public/data/snapshot-v1.json (the production ETL output)
 * using realistic DRAFTED rosters — random franchise×decade spins where the
 * picker takes one of the top 3 pool players — as the reference population
 * (see scripts/etl/dist-check.ts). Targets:
 *  - drafted rosters cluster in the ~55–70 win band, with 70+ reachable by
 *    a top-decile draft,
 *  - the all-time roster (Magic/MJ/Bird/Duncan/Wilt + Curry/Hakeem/Jokić)
 *    clears every gate and reaches 82-0,
 *  - 82-0 is effectively unreachable without deliberate, hole-free
 *    construction around transcendent anchors,
 *  - one glaring categorical weakness caps the record via per-cat gates.
 */

import { NineCat } from "@/lib/contracts";

/** Z-scores are clamped to ±Z_CLAMP so outliers (Wilt) are elite, not infinite. */
export const Z_CLAMP = 4.5;

/** Per-category weights for the player composite (sum to 1.0). `tov` is already
 *  sign-flipped in AdjustedStats, so its weight is a positive reward for low
 *  turnovers / penalty for high ones. tpm and tov are deliberately near-zero:
 *  threes barely existed for most eras, and high turnovers are mostly star
 *  usage tax — every star-built team sits at tov z ≈ −1 to −2, so any real
 *  weight here just suppresses the whole win distribution. */
export const CAT_WEIGHTS: Record<NineCat, number> = {
  pts: 0.26,
  reb: 0.18,
  ast: 0.17,
  stl: 0.09,
  blk: 0.09,
  fgPct: 0.09,
  ftPct: 0.05,
  tpm: 0.04,
  tov: 0.03,
};

/** Fraction of playerScore that comes from the ortg/drtg blend (the rest is
 *  the 9-cat composite). Ratings capture era-relative impact the box cats miss. */
export const RATING_BLEND = 0.3;

/**
 * Out-of-position multipliers indexed by positional distance along
 * PG–SG–SF–PF–C (min distance over [position, ...altPositions]).
 * Adjacent slides (SG↔SF) are mild; PG↔C is harsh.
 */
export const POSITION_PENALTY = [1.0, 0.92, 0.85, 0.8, 0.75] as const;

/** OVR = clamp(OVR_BASE + OVR_SLOPE * weighted-average playerScore, 0, OVR_MAX). */
export const OVR_BASE = 52;
export const OVR_SLOPE = 41;

/** wins(curve) = round(82 * (ovr / OVR_MAX) ** WIN_CURVE_EXP). 1.15 keeps the
 *  curve near-linear (drafted teams: OVR ~80–94 → ~57–69 wins) while 82 wins
 *  still demands OVR at the 110 ceiling. */
export const WIN_CURVE_EXP = 1.15;

/**
 * Category gates — the signature mechanic. Each cat's team z (weighted-average
 * catProfile value) maps to a win cap; the binding gate is the min across cats.
 *
 * Thresholds are PER CATEGORY because the cats live on very different team-z
 * scales for drafted rosters (drafted p05/p50/p95 measured on snapshot-v1:
 * pts 0.64/1.33/2.02 but tov -1.57/-0.89/-0.23 — every star-built team is
 * below pool average on turnovers, and the all-time greats run -2.07). Each
 * threshold sits just under the drafted p05 for its cat, so a genuine hole —
 * not normal star tax — triggers the gate.
 */
export const GATE_THRESHOLDS: Record<NineCat, number> = {
  pts: 0.4,
  reb: 0.3,
  ast: -0.3,
  stl: -0.25,
  blk: -0.15,
  fgPct: -0.05,
  ftPct: -0.85,
  tpm: -1.0,
  tov: -2.8,
};

/** Win caps by how far below the cat's threshold the team z falls. */
export const GATE_STEPS: ReadonlyArray<readonly [offset: number, winCap: number]> = [
  [0, 82],
  [-0.4, 74],
  [-0.8, 66],
  [-1.2, 56],
];
/** Win cap when a cat's team z falls below every GATE_STEPS offset. */
export const GATE_FLOOR_CAP = 46;

/** Weights for the 0–100 offensive sub-rating (over team-average z values). */
export const OFF_WEIGHTS = {
  pts: 0.3,
  ast: 0.2,
  fgPct: 0.15,
  ftPct: 0.1,
  tpm: 0.1,
  ortg: 0.15,
} as const;

/** Weights for the 0–100 defensive sub-rating (over team-average z values). */
export const DEF_WEIGHTS = {
  reb: 0.3,
  stl: 0.2,
  blk: 0.25,
  drtg: 0.25,
} as const;

/** Sub-ratings map z → 50 + SUBRATING_SLOPE * z, clamped to [0, 100]. */
export const SUBRATING_SLOPE = 16;

/** Logistic scale for the OVR-difference term of per-game win probability. */
export const MATCHUP_OVR_SCALE = 7;
/** Logistic scale for the weighted category-edge term. */
export const MATCHUP_EDGE_SCALE = 0.4;
/** Blend between the OVR term (this fraction) and the category-edge term. */
export const MATCHUP_OVR_BLEND = 0.65;
