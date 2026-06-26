/**
 * Budget Matchups pricing layer.
 *
 * Derives a $5–$50 salary-cap price for each player from their era-adjusted
 * composite (playerScore), memoized per snapshot object (mirrors the
 * baselinesOf/playerMapOf pattern in snapshot-core.ts).
 *
 * Calibration:
 *   - Peak all-timers (Jordan, Wilt) → $50
 *   - Replacement-level pool fillers → $5
 *   - Linear ramp between PRICE_LO_SCORE and PRICE_HI_SCORE, snapped to the
 *     nearest $5 so UI reads cleanly.
 */

import type { EraBaselines, PlayerStatLine, Snapshot } from "./contracts";
import { baselinesOf, playerMapOf } from "./snapshot-core";
import { engine } from "@/engine";

/** Scores below this floor price at $5 (replacement level). */
export const PRICE_LO_SCORE = 0.0;
/**
 * Scores at or above this ceiling price at $50 (peak all-timer).
 * Calibrated so that the best players in the snapshot (Jordan ≈1.87,
 * Wilt ≈2.49 era-adjusted) are clamped to $50; anything above also caps at
 * $50 via the clamp in priceOf.
 */
export const PRICE_HI_SCORE = 1.8;

export const PRICE_MIN = 5;
export const PRICE_MAX = 50;
export const PRICE_STEP = 5;

/**
 * Snap a continuous price value to the nearest $5 tier, clamped to [5, 50].
 */
export function snapPrice(raw: number): number {
  const tier = Math.round(raw / PRICE_STEP) * PRICE_STEP;
  return Math.max(PRICE_MIN, Math.min(PRICE_MAX, tier));
}

/**
 * Compute the budget price for a single player given pre-computed baselines.
 * Exposed for unit tests and the client-side price display.
 */
export function priceOf(
  player: PlayerStatLine,
  baselines: EraBaselines
): number {
  const adj = engine.eraAdjust(player, baselines);
  const score = engine.playerScore(adj);
  // Linear interpolation between floor and ceiling, clamped to [0,1] so
  // players above PRICE_HI_SCORE all land at $50, then snap to $5 tier.
  const t = Math.min(1, Math.max(0, (score - PRICE_LO_SCORE) / (PRICE_HI_SCORE - PRICE_LO_SCORE)));
  const raw = PRICE_MIN + t * (PRICE_MAX - PRICE_MIN);
  return snapPrice(raw);
}

// Memoize per snapshot object (same WeakMap pattern as snapshot-core).
const priceMaps = new WeakMap<Snapshot, Map<string, number>>();

/**
 * Return a Map<playerId, price> for every player in the snapshot.
 * Memoized per snapshot object — the first call does O(n) work; subsequent
 * calls with the same snapshot are O(1).
 */
export function priceMapOf(snapshot: Snapshot): Map<string, number> {
  let map = priceMaps.get(snapshot);
  if (!map) {
    const players = playerMapOf(snapshot);
    const baselines = baselinesOf(snapshot);
    map = new Map();
    for (const [id, player] of players) {
      map.set(id, priceOf(player, baselines));
    }
    priceMaps.set(snapshot, map);
  }
  return map;
}
