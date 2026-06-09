/**
 * Distribution tests for the tuning targets: random valid 8-man rosters from
 * the fixture pool (a pool made entirely of stars) should mostly land in the
 * 45–75 win band, with 82-0 vanishingly rare, while the curated all-time
 * roster pushes 78–82.
 */

import { describe, expect, it } from "vitest";
import { Roster } from "@/lib/contracts";
import { engine } from "./index";
import { ALL_TIME, BALANCED, baselines, players, randomRosters } from "./test-helpers";

const project = (r: Roster) =>
  engine.projectSeason(engine.teamRating(r, players, baselines));

const SAMPLE_SEED = 20260609;
const N = 2000;

describe("win distribution over random rosters", () => {
  const seasons = randomRosters(SAMPLE_SEED, N).map(project);
  const wins = seasons.map((s) => s.wins);

  it("lands mostly in the 45–75 band", () => {
    const inBand = wins.filter((w) => w >= 45 && w <= 75).length;
    expect(inBand / N).toBeGreaterThan(0.9);
  });

  it("makes 82-0 rare (well under 10% of random rosters)", () => {
    const perfect = wins.filter((w) => w === 82).length;
    expect(perfect / N).toBeLessThan(0.02);
  });

  it("has a sane central tendency (median in the mid-50s to mid-60s)", () => {
    const sorted = [...wins].sort((a, b) => a - b);
    const median = sorted[Math.floor(N / 2)];
    expect(median).toBeGreaterThanOrEqual(50);
    expect(median).toBeLessThanOrEqual(68);
  });

  it("produces meaningful spread (random rosters are not all alike)", () => {
    const min = Math.min(...wins);
    const max = Math.max(...wins);
    expect(max - min).toBeGreaterThanOrEqual(15);
  });

  it("gates fire on a meaningful minority of careless random rosters", () => {
    const gated = seasons.filter((s) => s.gatedCategory !== null).length;
    expect(gated / N).toBeGreaterThan(0.05);
    expect(gated / N).toBeLessThan(0.8);
  });
});

describe("anchor rosters hit their bands", () => {
  it("all-time roster: 78–82 wins, OVR 100+, no gate", () => {
    const s = project(ALL_TIME);
    expect(s.ovr).toBeGreaterThanOrEqual(100);
    expect(s.wins).toBeGreaterThanOrEqual(78);
    expect(s.wins).toBeLessThanOrEqual(82);
    expect(s.gatedCategory).toBeNull();
  });

  it("balanced-but-unspectacular roster: 50–68 wins", () => {
    const s = project(BALANCED);
    expect(s.wins).toBeGreaterThanOrEqual(50);
    expect(s.wins).toBeLessThanOrEqual(68);
  });

  it("the all-time roster beats nearly every random roster", () => {
    const allTime = project(ALL_TIME).wins;
    const better = randomRosters(7777, 500)
      .map(project)
      .filter((s) => s.wins >= allTime).length;
    expect(better / 500).toBeLessThan(0.01);
  });
});
