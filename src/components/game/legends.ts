/**
 * Legendary "jackpot" pool lines — the top LEGEND_COUNT player lines across
 * the whole snapshot ranked by the engine's playerScore. Computed lazily once
 * per session (one pass over ~2000 lines) and memoized at module level so
 * per-row lookups during pool renders are a Set hit.
 */

import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getSnapshot } from "@/lib/snapshot";

export const LEGEND_COUNT = 25;

let legendIds: Set<string> | null = null;

function computeLegendIds(): Set<string> {
  const engine = getEngine();
  const baselines = getBaselines();
  const scored = getSnapshot().players.map((p) => ({
    id: p.id,
    score: engine.playerScore(engine.eraAdjust(p, baselines)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return new Set(scored.slice(0, LEGEND_COUNT).map((s) => s.id));
}

export function getLegendIds(): ReadonlySet<string> {
  return (legendIds ??= computeLegendIds());
}

/** Is this pool-line id one of the all-time-great "jackpot" pulls? */
export function isLegendary(id: string): boolean {
  return getLegendIds().has(id);
}
