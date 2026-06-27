/**
 * Budget Matchups pricing layer.
 *
 * Derives a $5–$35 salary-cap price for each player from their era-adjusted
 * composite (playerScore), memoized per snapshot object (mirrors the
 * baselinesOf/playerMapOf pattern in snapshot-core.ts).
 *
 * Calibration:
 *   - Peak all-timers (Jordan, Wilt) → $35; Hall-of-Fame tier → $30–$35
 *   - Replacement-level pool fillers → $5
 *   - Linear ramp between PRICE_LO_SCORE and PRICE_HI_SCORE, snapped to the
 *     nearest $5 so UI reads cleanly.
 *
 * Why $35 (not $50): with 8-man rosters and a $5 floor, two stars priced $T
 * cost 2·T + 6·$5. A $35 ceiling keeps two top-tier stars affordable on every
 * difficulty — two $20 stars fit the Hard $75 cap (2·20 + 30 = $70), two $35
 * all-timers fit Normal $100 — so a budget team can always field a real core.
 */

import { POSITIONS } from "./contracts";
import type { EraBaselines, PlayerStatLine, Position, Snapshot } from "./contracts";
import { baselinesOf, playerMapOf } from "./snapshot-core";
import { engine } from "@/engine";

/** Scores below this floor price at $5 (replacement level). */
export const PRICE_LO_SCORE = 0.0;
/**
 * Scores at or above this ceiling price at $35 (peak all-timer).
 * Calibrated so that the best players in the snapshot (Jordan ≈1.87,
 * Wilt ≈2.49 era-adjusted) are clamped to $35; anything above also caps at
 * $35 via the clamp in priceOf.
 */
export const PRICE_HI_SCORE = 1.8;

export const PRICE_MIN = 5;
export const PRICE_MAX = 35;
export const PRICE_STEP = 5;

/**
 * Snap a continuous price value to the nearest $5 tier, clamped to [5, 50].
 */
export function snapPrice(raw: number): number {
  const tier = Math.round(raw / PRICE_STEP) * PRICE_STEP;
  return Math.max(PRICE_MIN, Math.min(PRICE_MAX, tier));
}

/** Era-adjusted composite score for a player — the basis for pricing. */
export function scoreOf(player: PlayerStatLine, baselines: EraBaselines): number {
  return engine.playerScore(engine.eraAdjust(player, baselines));
}

/**
 * Map a composite score to a snapped $5 tier via the global price ramp.
 * Linear between the floor and ceiling, clamped so anything at/above
 * PRICE_HI_SCORE lands at $35, then snapped to the nearest $5.
 */
export function priceFromScore(score: number): number {
  const t = Math.min(1, Math.max(0, (score - PRICE_LO_SCORE) / (PRICE_HI_SCORE - PRICE_LO_SCORE)));
  const raw = PRICE_MIN + t * (PRICE_MAX - PRICE_MIN);
  return snapPrice(raw);
}

/**
 * Compute the budget price for a single player given pre-computed baselines.
 * Exposed for unit tests and the client-side price display.
 *
 * `scoreOffset` shifts the composite before the ramp. priceMapOf passes a
 * per-position offset (see positionPriceOffsets) so no slot — notably C, which
 * the composite over-rewards for rebounds/blocks/FG% — is systematically
 * pricier than the others. The single-arg form (offset 0) is the raw ramp.
 */
export function priceOf(
  player: PlayerStatLine,
  baselines: EraBaselines,
  scoreOffset = 0
): number {
  return priceFromScore(scoreOf(player, baselines) - scoreOffset);
}

/**
 * Per-position score offset = (position's mean composite − league mean).
 * Subtracting it before the ramp equalizes the *average* price across the five
 * starting slots, removing the structural center premium (centers averaged
 * ~$13 vs ~$8–10 elsewhere) while preserving merit *within* a position: elite
 * bigs still clamp to $35, replacement-level players still floor at $5.
 */
export function positionPriceOffsets(
  players: Map<string, PlayerStatLine>,
  baselines: EraBaselines
): Record<Position, number> {
  const sum = {} as Record<Position, number>;
  const count = {} as Record<Position, number>;
  for (const pos of POSITIONS) {
    sum[pos] = 0;
    count[pos] = 0;
  }
  let total = 0;
  for (const player of players.values()) {
    const score = scoreOf(player, baselines);
    sum[player.position] += score;
    count[player.position] += 1;
    total += score;
  }
  const leagueMean = total / players.size;
  const offsets = {} as Record<Position, number>;
  for (const pos of POSITIONS) {
    offsets[pos] = count[pos] > 0 ? sum[pos] / count[pos] - leagueMean : 0;
  }
  return offsets;
}

// Memoize per snapshot object (same WeakMap pattern as snapshot-core).
const priceMaps = new WeakMap<Snapshot, Map<string, number>>();

/**
 * Return a Map<playerId, price> for every player in the snapshot, priced with
 * the per-position normalization so each starting slot costs roughly the same
 * on average. Memoized per snapshot object — the first call does O(n) work;
 * subsequent calls with the same snapshot are O(1).
 */
export function priceMapOf(snapshot: Snapshot): Map<string, number> {
  let map = priceMaps.get(snapshot);
  if (!map) {
    const players = playerMapOf(snapshot);
    const baselines = baselinesOf(snapshot);
    const offsets = positionPriceOffsets(players, baselines);
    map = new Map();
    for (const [id, player] of players) {
      map.set(id, priceOf(player, baselines, offsets[player.position]));
    }
    priceMaps.set(snapshot, map);
  }
  return map;
}
