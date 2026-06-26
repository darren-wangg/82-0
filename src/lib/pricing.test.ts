/**
 * Unit tests for src/lib/pricing.ts.
 *
 * Pins: outputs are multiples of $5 in [$5, $50], monotonic in playerScore,
 * known all-timers = $50, known fillers = $5.
 */

import { describe, it, expect } from "vitest";
import { getBaselines, getPlayerMap, getSnapshot } from "./snapshot";
import { priceOf, priceMapOf, snapPrice, PRICE_MIN, PRICE_MAX, PRICE_STEP } from "./pricing";
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
});
