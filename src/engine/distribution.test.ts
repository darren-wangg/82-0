/**
 * Distribution tests for the tuning targets, measured over realistic DRAFTED
 * rosters (random franchise×decade spins, picker takes a top-3 pool player):
 * mostly 45–75 wins, median high-50s, 82-0 effectively unreachable without
 * deliberate construction, gates firing on a meaningful minority.
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

  it("lands mostly in the 45–75 band", () => {
    const inBand = wins.filter((w) => w >= 45 && w <= 75).length;
    expect(inBand / N).toBeGreaterThan(0.9);
  });

  it("makes 82-0 effectively unreachable by casual drafting", () => {
    const perfect = wins.filter((w) => w === 82).length;
    expect(perfect / N).toBeLessThan(0.02);
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
    expect(s.ovr).toBe(110);
    expect(s.wins).toBe(82);
    expect(s.gatedCategory).toBeNull();
  });

  it("balanced-but-unspectacular roster: 50–72 wins", () => {
    const s = project(BALANCED);
    expect(s.wins).toBeGreaterThanOrEqual(50);
    expect(s.wins).toBeLessThanOrEqual(72);
  });

  it("the all-time roster beats nearly every drafted roster", () => {
    const allTime = project(ALL_TIME).wins;
    const better = draftedRosters(7777, 300, score)
      .map(project)
      .filter((s) => s.wins >= allTime).length;
    expect(better / 300).toBeLessThan(0.01);
  });

  it("careless uniform-random rosters (role players included) are clearly worse", () => {
    const med = (arr: number[]) =>
      [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const random = med(randomRosters(31, 300).map((r) => project(r).wins));
    const drafted = med(draftedRosters(31, 300, score).map((r) => project(r).wins));
    expect(random).toBeLessThan(drafted);
  });
});
