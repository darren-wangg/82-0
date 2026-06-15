import type { NineCat } from "@/lib/contracts";

/**
 * Turnover z is computed against the whole player pool with weakest-link
 * aggregation, so every star-built roster lands well below 0 — the median
 * drafted contender sits at tov z ≈ -0.9 purely because elite creators carry
 * high usage (see the drafted-roster baseline in engine/season.test.ts). On a
 * bar centered at 0 = pool average that means a normal title team's turnovers
 * always read as a weakness, and a positive TOV rating is unreachable.
 *
 * Re-center the DISPLAYED tov value on that contender baseline so 0 ≈ "normal
 * ball security for a title team", positive = takes care of it better than most
 * contenders, negative = a genuine turnover problem. Display/AI only — the
 * engine's per-cat gate math runs on the raw catProfile and is untouched, so
 * records and the gate callouts don't move.
 */
export const TOV_DISPLAY_BASELINE = 0.9;

/** Re-center a raw catProfile z for display (currently only tov shifts). */
export function displayCatValue(cat: NineCat, raw: number): number {
  return cat === "tov" ? raw + TOV_DISPLAY_BASELINE : raw;
}
