/**
 * Unit tests for src/lib/pricing.ts.
 *
 * Pins: outputs are multiples of $5 in [$5, $50], monotonic in playerScore,
 * known all-timers = $50, known fillers = $5.
 */

import { describe, it, expect } from "vitest";
import { getBaselines, getPlayerMap, getSnapshot } from "./snapshot";
import {
  priceOf,
  priceMapOf,
  positionPriceOffsets,
  scoreOf,
  snapPrice,
  PRICE_MIN,
  PRICE_MAX,
  PRICE_STEP,
} from "./pricing";
import { POSITIONS, type Position } from "./contracts";
import { engine } from "@/engine";

const snapshot = getSnapshot();
const players = getPlayerMap(snapshot);
const baselines = getBaselines(snapshot);

describe("snapPrice", () => {
  it("snaps to the nearest $5 tier", () => {
    expect(snapPrice(7)).toBe(5);
    expect(snapPrice(8)).toBe(10);
    expect(snapPrice(12)).toBe(10);
    expect(snapPrice(13)).toBe(15);
    expect(snapPrice(27)).toBe(25);
    expect(snapPrice(28)).toBe(30);
  });

  it("clamps below PRICE_MIN to $5", () => {
    expect(snapPrice(-100)).toBe(PRICE_MIN);
    expect(snapPrice(0)).toBe(PRICE_MIN);
    expect(snapPrice(2)).toBe(PRICE_MIN);
  });

  it("clamps above PRICE_MAX to $50", () => {
    expect(snapPrice(51)).toBe(PRICE_MAX);
    expect(snapPrice(1000)).toBe(PRICE_MAX);
  });
});

describe("priceOf", () => {
  it("returns a multiple of PRICE_STEP", () => {
    for (const player of players.values()) {
      const price = priceOf(player, baselines);
      expect(price % PRICE_STEP).toBe(0);
    }
  });

  it("is in [PRICE_MIN, PRICE_MAX] for all players", () => {
    for (const player of players.values()) {
      const price = priceOf(player, baselines);
      expect(price).toBeGreaterThanOrEqual(PRICE_MIN);
      expect(price).toBeLessThanOrEqual(PRICE_MAX);
    }
  });

  it("is monotonic in playerScore: higher score → same or higher price", () => {
    // Build price map sorted by score ascending; price must be non-decreasing.
    const scored = [...players.values()].map((p) => {
      const adj = engine.eraAdjust(p, baselines);
      const score = engine.playerScore(adj);
      const price = priceOf(p, baselines);
      return { score, price };
    });
    scored.sort((a, b) => a.score - b.score);

    for (let i = 1; i < scored.length; i++) {
      if (scored[i].score > scored[i - 1].score) {
        // Higher score must yield same or higher price.
        expect(scored[i].price).toBeGreaterThanOrEqual(scored[i - 1].price);
      }
    }
  });

  it("prices Jordan (CHI 1990s) at $50", () => {
    const jordan = players.get("jordami01-CHI-1990s")!;
    expect(jordan).toBeDefined();
    expect(priceOf(jordan, baselines)).toBe(50);
  });

  it("prices Wilt Chamberlain (GSW 1960s) at $50", () => {
    const wilt = players.get("chambwi01-GSW-1960s")!;
    expect(wilt).toBeDefined();
    expect(priceOf(wilt, baselines)).toBe(50);
  });

  it("prices a replacement-level player at $5", () => {
    // Find the player with the lowest playerScore.
    let minScore = Infinity;
    let minPrice = PRICE_MAX;
    for (const p of players.values()) {
      const adj = engine.eraAdjust(p, baselines);
      const score = engine.playerScore(adj);
      if (score < minScore) {
        minScore = score;
        minPrice = priceOf(p, baselines);
      }
    }
    expect(minPrice).toBe(PRICE_MIN);
  });
});

describe("priceMapOf", () => {
  it("memoizes: same snapshot object returns the same Map instance", () => {
    const a = priceMapOf(snapshot);
    const b = priceMapOf(snapshot);
    expect(a).toBe(b); // referential equality (same WeakMap entry)
  });

  it("covers every player in the snapshot", () => {
    const map = priceMapOf(snapshot);
    for (const p of snapshot.players) {
      expect(map.has(p.id)).toBe(true);
    }
    expect(map.size).toBe(snapshot.players.length);
  });

  it("all values are multiples of $5 in [$5, $50]", () => {
    const map = priceMapOf(snapshot);
    for (const [, price] of map) {
      expect(price % PRICE_STEP).toBe(0);
      expect(price).toBeGreaterThanOrEqual(PRICE_MIN);
      expect(price).toBeLessThanOrEqual(PRICE_MAX);
    }
  });

  it("still prices the all-timers (Jordan, Wilt) at $50 after normalization", () => {
    const map = priceMapOf(snapshot);
    expect(map.get("jordami01-CHI-1990s")).toBe(50);
    expect(map.get("chambwi01-GSW-1960s")).toBe(50);
  });

  it("equalizes mean price across the five starting slots (no center premium)", () => {
    const map = priceMapOf(snapshot);
    const sum = {} as Record<Position, number>;
    const count = {} as Record<Position, number>;
    for (const pos of POSITIONS) {
      sum[pos] = 0;
      count[pos] = 0;
    }
    for (const p of players.values()) {
      sum[p.position] += map.get(p.id)!;
      count[p.position] += 1;
    }
    const means = POSITIONS.map((pos) => sum[pos] / count[pos]);
    const spread = Math.max(...means) - Math.min(...means);
    // Before normalization C averaged ~$13 vs ~$8 at SG (a ~$5 gap); the
    // per-position offset closes it to a tight band.
    expect(spread).toBeLessThanOrEqual(2);
  });

  it("is monotonic in score *within* each position", () => {
    const map = priceMapOf(snapshot);
    for (const pos of POSITIONS) {
      const scored = [...players.values()]
        .filter((p) => p.position === pos)
        .map((p) => ({ score: scoreOf(p, baselines), price: map.get(p.id)! }))
        .sort((a, b) => a.score - b.score);
      for (let i = 1; i < scored.length; i++) {
        if (scored[i].score > scored[i - 1].score) {
          expect(scored[i].price).toBeGreaterThanOrEqual(scored[i - 1].price);
        }
      }
    }
  });
});

describe("positionPriceOffsets", () => {
  it("offsets centers up (composite over-rewards them) and guards down", () => {
    const offsets = positionPriceOffsets(players, baselines);
    // C carries the highest mean composite → largest positive offset (priced
    // down); SG the lowest → negative offset (priced up).
    expect(offsets.C).toBeGreaterThan(0);
    expect(offsets.SG).toBeLessThan(0);
    expect(offsets.C).toBeGreaterThan(offsets.SG);
  });
});
