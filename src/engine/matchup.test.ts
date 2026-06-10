import { describe, expect, it } from "vitest";
import { NINE_CATS } from "@/lib/contracts";
import { engine, gameWinProbability } from "./index";
import {
  ALL_CENTERS,
  ALL_TIME,
  BALANCED,
  baselines,
  players,
} from "./test-helpers";

const A = engine.teamRating(ALL_TIME, players, baselines);
const B = engine.teamRating(BALANCED, players, baselines);
const C = engine.teamRating(ALL_CENTERS, players, baselines);

describe("gameWinProbability", () => {
  it("favors the stronger team and stays in (0, 1)", () => {
    const p = gameWinProbability(A, B);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  it("is complementary: p(A,B) + p(B,A) = 1", () => {
    expect(gameWinProbability(A, B) + gameWinProbability(B, A)).toBeCloseTo(1, 12);
    expect(gameWinProbability(B, C) + gameWinProbability(C, B)).toBeCloseTo(1, 12);
  });

  it("a team is a coin flip against itself", () => {
    expect(gameWinProbability(A, A)).toBeCloseTo(0.5, 12);
  });
});

describe("simulateMatchup", () => {
  it("golden master: all-time vs balanced, seed 42", () => {
    const m = engine.simulateMatchup(A, B, 42);
    expect(m.winner).toBe("A");
    expect(m.seriesScore).toEqual([4, 0]);
    expect(m.pGameA).toBeCloseTo(0.9007, 3);
    expect(m.seed).toBe(42);
  });

  it("is deterministic: same inputs + seed → deep-equal result", () => {
    for (const seed of [0, 1, 42, 12345, 2 ** 31 - 1]) {
      expect(engine.simulateMatchup(A, B, seed)).toEqual(
        engine.simulateMatchup(A, B, seed)
      );
    }
  });

  it("different seeds can produce different series", () => {
    const results = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      results.add(JSON.stringify(engine.simulateMatchup(B, C, seed).seriesScore));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("always returns a valid best-of-7 score consistent with the winner", () => {
    for (let seed = 0; seed < 200; seed++) {
      const m = engine.simulateMatchup(B, C, seed);
      const [a, b] = m.seriesScore;
      expect(Math.max(a, b)).toBe(4);
      expect(Math.min(a, b)).toBeGreaterThanOrEqual(0);
      expect(Math.min(a, b)).toBeLessThanOrEqual(3);
      expect(m.winner).toBe(a > b ? "A" : "B");
      expect(m.pGameA).toBeGreaterThan(0);
      expect(m.pGameA).toBeLessThan(1);
      expect(m.seed).toBe(seed);
    }
  });

  it("covers all 9 cats in catBreakdown with edge = teamA - teamB", () => {
    const m = engine.simulateMatchup(A, C, 7);
    expect(m.catBreakdown.map((e) => e.cat)).toEqual([...NINE_CATS]);
    for (const e of m.catBreakdown) {
      expect(e.teamA).toBe(A.catProfile[e.cat]);
      expect(e.teamB).toBe(C.catProfile[e.cat]);
      expect(e.edge).toBeCloseTo(e.teamA - e.teamB, 12);
    }
  });

  it("the much stronger team wins the large majority of seeded series", () => {
    let aSeries = 0;
    const n = 500;
    for (let seed = 0; seed < n; seed++) {
      if (engine.simulateMatchup(A, B, seed).winner === "A") aSeries++;
    }
    expect(aSeries / n).toBeGreaterThan(0.9);
  });
});
