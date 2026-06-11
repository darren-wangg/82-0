/**
 * Tuning constants for the 82-0 Plus simulation engine.
 *
 * Calibrated against public/data/snapshot-v1.json (the production ETL output)
 * using realistic DRAFTED rosters — random franchise×decade spins where the
 * picker takes one of the top 3 pool players — as the reference population
 * (see scripts/etl/dist-check.ts). Targets:
 *  - drafted rosters cluster around a ~65-win median, with 75+ reachable by
 *    a top-decile draft,
 *  - the all-time roster (Magic/MJ/Bird/Duncan/Wilt + Curry/Hakeem/Jokić)
 *    clears every gate and reaches 82-0,
 *  - a perfect 82-0 lands roughly 1 in 50 drafts — rare enough to chase,
 *    common enough to believe in,
 *  - one glaring categorical weakness caps the record via per-cat gates.
 */

import { NineCat } from "@/lib/contracts";

/** Z-scores are clamped to ±Z_CLAMP so outliers (Wilt) are elite, not infinite. */
export const Z_CLAMP = 4.5;

/** Per-category weights for the player composite (sum to 1.0). `tov` carries
 *  zero composite weight: high turnovers are mostly star usage tax — every
 *  star-built team sits at tov z ≈ −1 to −2, so any weight here just
 *  suppresses the whole win distribution. Turnovers still matter via the tov
 *  gate, which only a deliberate high-usage stack trips. tpm is near-zero
 *  because threes barely existed for most eras. */
export const CAT_WEIGHTS: Record<NineCat, number> = {
  pts: 0.28,
  reb: 0.19,
  ast: 0.18,
  stl: 0.09,
  blk: 0.09,
  fgPct: 0.11,
  ftPct: 0.04,
  tpm: 0.02,
  tov: 0,
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

/** OVR = clamp(OVR_BASE + OVR_SLOPE * weighted-average playerScore, 0, OVR_MAX).
 *  Steep on purpose (base holds the drafted median at ~65 wins): calibrated
 *  on the realistic top-3 drafter so a perfect 82-0 lands ~1 in 50 drafts
 *  (med 65, p90 75, min ~44 on snapshot-v1). */
export const OVR_BASE = 30.3;
export const OVR_SLOPE = 56;

/** wins(curve) = round(82 * (ovr / OVR_MAX) ** WIN_CURVE_EXP). 1.15 keeps the
 *  curve near-linear (drafted teams: OVR ~75–88 → ~58–71 wins) while 82 wins
 *  still demands OVR at the 100 ceiling. */
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
  ftPct: -0.9,
  tpm: -1.0,
  tov: -3.0,
};

/** Win caps by how far below the cat's threshold the team z falls. The 78
 *  tier keeps a mild hole from erasing the entire 75–81 win band — only a
 *  deeper hole drops the cap to 74 and below. */
export const GATE_STEPS: ReadonlyArray<readonly [offset: number, winCap: number]> = [
  [0, 82],
  [-0.2, 78],
  [-0.5, 74],
  [-0.9, 66],
  [-1.3, 56],
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
// 6.36 ≈ the original 7 rescaled by 100/110 with the OVR ceiling, so OVR
// differences carry the same matchup weight they did on the 110 scale.
export const MATCHUP_OVR_SCALE = 6.36;
/** Logistic scale for the weighted category-edge term. */
export const MATCHUP_EDGE_SCALE = 0.4;
/** Blend between the OVR term (this fraction) and the category-edge term. */
export const MATCHUP_OVR_BLEND = 0.65;
