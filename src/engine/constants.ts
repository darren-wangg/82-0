/**
 * Tuning constants for the 82-0 Plus simulation engine.
 *
 * Calibrated against fixtures/snapshot-mini.json so that:
 *  - the all-time roster (Magic/MJ/Bird/Duncan/Wilt + Curry/Hakeem/Jokić)
 *    lands at OVR ~108 and ~80 wins with every category gate cleared,
 *  - a balanced-but-unspectacular star roster lands in the 50–68 win band,
 *  - random valid 8-man rosters cluster in the 45–75 win band, and 82-0 is
 *    effectively unreachable without a transcendent, hole-free roster,
 *  - one glaring categorical weakness caps the record via the gate table.
 */

import { NineCat } from "@/lib/contracts";

/** Z-scores are clamped to ±Z_CLAMP so outliers (Wilt) are elite, not infinite. */
export const Z_CLAMP = 4.5;

/** Per-category weights for the player composite (sum to 1.0). `tov` is already
 *  sign-flipped in AdjustedStats, so its weight is a positive reward for low
 *  turnovers / penalty for high ones. */
export const CAT_WEIGHTS: Record<NineCat, number> = {
  pts: 0.22,
  reb: 0.15,
  ast: 0.15,
  stl: 0.09,
  blk: 0.09,
  fgPct: 0.08,
  ftPct: 0.05,
  tpm: 0.07,
  tov: 0.1,
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

/** wins(curve) = round(82 * (ovr / OVR_MAX) ** WIN_CURVE_EXP). */
export const WIN_CURVE_EXP = 1.9;

/**
 * Category gates — the signature mechanic. Each cat's team z (weighted-average
 * catProfile value) maps to a win cap; the binding gate is the min across cats.
 * Thresholds are tuned to the star-heavy pool: even legends average slightly
 * negative team tov z (~ -0.7), so the first gate sits below that, while a
 * genuine hole (z ≤ -0.85) starts costing wins.
 */
export const GATE_TABLE: ReadonlyArray<readonly [minZ: number, winCap: number]> = [
  [-0.85, 82],
  [-1.25, 74],
  [-1.75, 66],
  [-2.5, 56],
];
/** Win cap when a cat's team z falls below every GATE_TABLE threshold. */
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
