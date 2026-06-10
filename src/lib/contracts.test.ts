import { describe, expect, it } from "vitest";
import { DECADES, Roster } from "./contracts";
import { getBaselines, getPlayerMap, getPool, getSnapshot } from "./snapshot";
import { mockEngine } from "./engine-mock";

describe("fixture snapshot", () => {
  it("validates against SnapshotSchema", () => {
    expect(() => getSnapshot()).not.toThrow();
  });

  it("has a baseline for every decade", () => {
    const baselines = getBaselines();
    for (const d of DECADES) expect(baselines[d], d).toBeDefined();
  });

  it("pools only reference existing players, and every player is in a pool", () => {
    const snapshot = getSnapshot();
    const map = getPlayerMap(snapshot);
    const pooled = new Set<string>();
    for (const decades of Object.values(snapshot.pools)) {
      for (const ids of Object.values(decades)) {
        for (const id of ids) {
          expect(map.has(id), id).toBe(true);
          pooled.add(id);
        }
      }
    }
    for (const p of snapshot.players) expect(pooled.has(p.id), p.id).toBe(true);
  });

  it("contains Wilt's 1961-62 peak", () => {
    const wilt = getPool("GSW", "1960s").find((p) => p.playerSlug === "chambwi01");
    expect(wilt?.stats.pts).toBeCloseTo(50.4);
    expect(wilt?.stats.reb).toBeCloseTo(25.7);
  });
});

describe("mock engine (contract sanity)", () => {
  const snapshot = getSnapshot();
  const players = getPlayerMap(snapshot);
  const baselines = getBaselines(snapshot);

  const allTime: Roster = {
    starters: {
      PG: "johnsma02-LAL-1980s",
      SG: "jordami01-CHI-1990s",
      SF: "birdla01-BOS-1980s",
      PF: "duncati01-SAS-2000s",
      C: "chambwi01-GSW-1960s",
    },
    bench: ["curryst01-GSW-2010s", "olajuha01-HOU-1990s", "jokicni01-DEN-2020s"],
  };

  it("rates an all-time roster highly and projects a strong record", () => {
    const rating = mockEngine.teamRating(allTime, players, baselines);
    expect(rating.ovr).toBeGreaterThan(80);
    const season = mockEngine.projectSeason(rating);
    expect(season.wins + season.losses).toBe(82);
    expect(season.wins).toBeGreaterThan(50);
  });

  it("simulateMatchup is deterministic per seed", () => {
    const rating = mockEngine.teamRating(allTime, players, baselines);
    const weaker = { ...rating, ovr: rating.ovr - 15 };
    const a = mockEngine.simulateMatchup(rating, weaker, 42);
    const b = mockEngine.simulateMatchup(rating, weaker, 42);
    expect(a).toEqual(b);
  });
});
