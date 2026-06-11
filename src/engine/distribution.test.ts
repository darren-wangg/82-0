/**
 * Distribution tests for the tuning targets, measured over realistic DRAFTED
 * rosters (random franchise×decade spins, picker takes a top-3 pool player):
 * mostly 44–78 wins with a ~65-win median, a perfect 82-0 roughly 1 in 50
 * drafts (rare but chaseable), gates firing on a meaningful minority.
 */

import { describe, expect, it } from "vitest";
import { Roster } from "@/lib/contracts";
import { engine } from "./index";
import {
  ALL_TIME,
  BALANCED,
  baselines,
  draftedRosters,
  players,
  randomRosters,
} from "./test-helpers";

const project = (r: Roster) =>
  engine.projectSeason(engine.teamRating(r, players, baselines));
const score = (id: string) =>
  engine.playerScore(engine.eraAdjust(players.get(id)!, baselines));

const SAMPLE_SEED = 20260609;
const N = 1000;

describe("win distribution over drafted rosters", () => {
  const seasons = draftedRosters(SAMPLE_SEED, N, score).map(project);
  const wins = seasons.map((s) => s.wins);

  it("lands mostly in the 44–78 band", () => {
    const inBand = wins.filter((w) => w >= 44 && w <= 78).length;
    expect(inBand / N).toBeGreaterThan(0.9);
  });

  it("keeps 82-0 rare but chaseable (~1 in 50 drafts)", () => {
    const perfect = wins.filter((w) => w === 82).length;
    expect(perfect / N).toBeGreaterThan(0.005);
    expect(perfect / N).toBeLessThan(0.05);
  });

  it("has a sane central tendency (median in the mid-50s to mid-60s)", () => {
    const sorted = [...wins].sort((a, b) => a - b);
    const median = sorted[Math.floor(N / 2)];
    expect(median).toBeGreaterThanOrEqual(52);
    expect(median).toBeLessThanOrEqual(66);
  });

  it("produces meaningful spread (drafted rosters are not all alike)", () => {
    const min = Math.min(...wins);
    const max = Math.max(...wins);
    expect(max - min).toBeGreaterThanOrEqual(12);
  });

  it("gates fire on a meaningful minority of drafted rosters", () => {
    const gated = seasons.filter((s) => s.gatedCategory !== null).length;
    expect(gated / N).toBeGreaterThan(0.03);
    expect(gated / N).toBeLessThan(0.5);
  });
});

describe("anchor rosters hit their bands", () => {
  it("all-time roster: 82-0 at the OVR ceiling, no gate", () => {
    const s = project(ALL_TIME);
    expect(s.ovr).toBe(100);
    expect(s.wins).toBe(82);
    expect(s.gatedCategory).toBeNull();
  });

  it("balanced-but-unspectacular roster: 60–78 wins", () => {
    const s = project(BALANCED);
    expect(s.wins).toBeGreaterThanOrEqual(60);
    expect(s.wins).toBeLessThanOrEqual(78);
  });

  it("the all-time roster beats nearly every drafted roster", () => {
    const allTime = project(ALL_TIME).wins;
    const better = draftedRosters(7777, 300, score)
      .map(project)
      .filter((s) => s.wins >= allTime).length;
    // 82-0 is deliberately ~1-in-50 now, so "nearly every" means ≥95%.
    expect(better / 300).toBeLessThan(0.05);
  });

  it("careless uniform-random rosters (role players included) are clearly worse", () => {
    const med = (arr: number[]) =>
      [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const random = med(randomRosters(31, 300).map((r) => project(r).wins));
    const drafted = med(draftedRosters(31, 300, score).map((r) => project(r).wins));
    expect(random).toBeLessThan(drafted);
  });
});
