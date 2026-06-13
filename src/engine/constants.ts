/**
 * Tuning constants for the 82-0 Plus simulation engine.
 *
 * Calibrated against public/data/snapshot-v1.json (the production ETL output)
 * using realistic DRAFTED rosters — random franchise×decade spins where the
 * picker takes one of the top 3 pool players — as the reference population
 * (see scripts/etl/dist-check.ts). Targets:
 *  - drafted rosters cluster around a ~65-win median,
 *  - a perfect 82-0 is genuinely rare (~1 in 286 for the casual top-3 drafter,
 *    ~1 in 51 for a sharp top-2 drafter — measured on snapshot-v1), but
 *    reachable by a genuinely well-CONSTRUCTED team, not just the biggest pile
 *    of box-score stats,
 *  - the all-time roster (Magic/MJ/Bird/Duncan/Wilt + Curry/Hakeem/Jokić)
 *    clears every gate and reaches 82-0,
 *  - one glaring categorical weakness still caps the record via per-cat gates.
 *
 * ## Construction model (the "concave" rebuild)
 *
 * Team strength is no longer a flat weighted MEAN of the eight players. Each
 * category is aggregated with a rank-decay OWA (`dirAgg` in index.ts): the top
 * contributor drives it, the next counts γ as much, the next γ², and so on.
 * Two consequences fall out for free:
 *  - REDUNDANCY is taxed — a second elite scorer on the same roster only earns
 *    a fraction of the credit, so stacking ball-dominant stars no longer pays
 *    full price three times over.
 *  - COMPLEMENTARITY is rewarded — a roster where five different players each
 *    top a different category maxes every category's lead slot.
 *
 * Offense and defense are deliberately asymmetric, mirroring the sport:
 *  - OFFENSE is star-driven — one elite creator can carry, so offensive cats
 *    lean toward the MAX (γ = GAMMA_OFF, "best" direction).
 *  - DEFENSE is a chain — one non-defender gets hunted every possession, so
 *    coverage cats lean toward the WEAKEST LINK (γ = GAMMA_DEF, "worst"
 *    direction). This is what makes a two-way roster beat an all-offense one
 *    without any explicit balance penalty.
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

/** Fraction of the team composite that comes from the ortg/drtg blend (the
 *  rest is the 9-cat composite). Ratings capture era-relative impact the box
 *  cats miss. */
export const RATING_BLEND = 0.3;

// ---------------------------------------------------------------------------
// Concave aggregation (the construction model)
// ---------------------------------------------------------------------------

/** Aggregation direction per quantity. "best" = star-driven (sort desc, the
 *  top contributor dominates); "worst" = weakest-link (sort asc, the weakest
 *  contributor dominates). Offense leans best, defense/ball-security lean
 *  worst. ortg/drtg follow their side. */
export type AggDir = "best" | "worst";
export const CAT_DIRECTION: Record<NineCat, AggDir> = {
  pts: "best",
  ast: "best",
  fgPct: "best",
  ftPct: "best",
  tpm: "best",
  reb: "worst",
  stl: "worst",
  blk: "worst",
  tov: "worst",
};
export const ORTG_DIRECTION: AggDir = "best";
export const DRTG_DIRECTION: AggDir = "worst";

/** Rank-decay factor for the best-direction (offense) aggregation. Lower =
 *  more star-driven (γ→0 is the pure max; γ→1 is the flat mean). 0.5 means the
 *  2nd contributor counts half, the 3rd a quarter. */
export const GAMMA_OFF = 0.5;
/** Rank-decay for the worst-direction (defense) aggregation. Higher than
 *  GAMMA_OFF so a single weak link drags but doesn't fully erase team defense
 *  — the rest of the unit still counts for something. */
export const GAMMA_DEF = 0.68;

/** Bench contributes as a discounted BLOCK: each category aggregates starters
 *  and bench separately, then blends `(starter + BENCH_BLOCK_W·bench)`. Keeps
 *  the rating monotone (no rank-reordering across the starter/bench boundary)
 *  while letting depth matter less than the starting five. */
export const BENCH_BLOCK_W = 0.45;

/**
 * Out-of-position multipliers indexed by positional distance along
 * PG–SG–SF–PF–C (min distance over [position, ...altPositions]).
 * Adjacent slides (SG↔SF) are mild; PG↔C is harsh. Applied as a monotone
 * multiplier on the team talent composite via the mean starter factor.
 */
export const POSITION_PENALTY = [1.0, 0.92, 0.85, 0.8, 0.75] as const;

/** OVR = clamp(OVR_BASE + OVR_SLOPE · posMult · teamComposite, 0, OVR_MAX).
 *  teamComposite is the concave 9-cat + ratings blend; posMult is the mean
 *  starter position factor. Base holds the drafted median near ~65 wins; slope
 *  sets how rare the OVR-100 ceiling (and so 82-0) is. */
export const OVR_BASE = 36.3;
export const OVR_SLOPE = 42.4;

/** wins(curve) = round(82 · (ovr / OVR_MAX) ** WIN_CURVE_EXP). 1.15 keeps the
 *  curve near-linear while 82 wins still demands OVR at the 100 ceiling. */
export const WIN_CURVE_EXP = 1.15;

/**
 * Category gates — the signature mechanic. Each cat's team z (the concave
 * catProfile value) maps to a win cap; the binding gate is the min across
 * cats. Thresholds are PER CATEGORY because the cats live on very different
 * team-z scales, and they sit just under the drafted p05 for each cat so a
 * genuine hole — not normal star tax — triggers the gate. Re-fit against the
 * concave catProfile distribution (worst-direction defense cats now run lower
 * for teams with a coverage hole, which is the point).
 */
export const GATE_THRESHOLDS: Record<NineCat, number> = {
  pts: 0.7,
  reb: 0.1,
  ast: -0.2,
  stl: -0.45,
  blk: -0.4,
  fgPct: 0.0,
  ftPct: -1.1,
  tpm: -0.9,
  tov: -3.2,
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

/** Weights for the 0–100 offensive sub-rating (over the concave team z values). */
export const OFF_WEIGHTS = {
  pts: 0.3,
  ast: 0.2,
  fgPct: 0.15,
  ftPct: 0.1,
  tpm: 0.1,
  ortg: 0.15,
} as const;

/** Weights for the 0–100 defensive sub-rating (over the concave team z values). */
export const DEF_WEIGHTS = {
  reb: 0.3,
  stl: 0.2,
  blk: 0.25,
  drtg: 0.25,
} as const;

/**
 * Sub-ratings map their z-composite → a 0–100 value, clamped. Unlike a raw
 * "50 = league average" scale, OFF and DEF are each calibrated onto the SAME
 * ceiling scale as OVR (per-side base + slope fit so the drafted median lands
 * ~81.5 and the p05/p95 span ~72/92, matching the OVR distribution). That way
 * OVR, OFF and DEF read as comparable magnitudes — a team's OFF-vs-DEF gap
 * still shows its lean, but a 90+ OVR team no longer shows OFF/DEF in the 60s.
 * The defensive composite runs lower (weakest-link aggregation), so DEF needs
 * a higher base than OFF to reach the same scale.
 */
export const OFF_BASE = 44.8;
export const OFF_SLOPE = 25.3;
export const DEF_BASE = 70.2;
export const DEF_SLOPE = 23;

/** Logistic scale for the OVR-difference term of per-game win probability. */
// 6.36 ≈ the original 7 rescaled by 100/110 with the OVR ceiling, so OVR
// differences carry the same matchup weight they did on the 110 scale.
export const MATCHUP_OVR_SCALE = 6.36;
/** Logistic scale for the weighted category-edge term. */
export const MATCHUP_EDGE_SCALE = 0.4;
/** Blend between the OVR term (this fraction) and the category-edge term. */
export const MATCHUP_OVR_BLEND = 0.65;
