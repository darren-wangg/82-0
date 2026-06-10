import { describe, expect, it } from "vitest";
import { Roster, SEASON_GAMES } from "@/lib/contracts";
import { engine, GATE_FLOOR_CAP, gateCapFor, GATE_TABLE } from "./index";
import {
  ALL_CENTERS,
  ALL_TIME,
  BALANCED,
  baselines,
  players,
  randomRosters,
  TURNOVER_PRONE,
} from "./test-helpers";

const project = (r: Roster) =>
  engine.projectSeason(engine.teamRating(r, players, baselines));

describe("gateCapFor", () => {
  it("maps team z to graduated win caps", () => {
    expect(gateCapFor(2)).toBe(SEASON_GAMES);
    expect(gateCapFor(GATE_TABLE[0][0])).toBe(SEASON_GAMES);
    expect(gateCapFor(-1.0)).toBe(74);
    expect(gateCapFor(-1.5)).toBe(66);
    expect(gateCapFor(-2.0)).toBe(56);
    expect(gateCapFor(-3.5)).toBe(GATE_FLOOR_CAP);
  });

  it("gate table is sorted strictly by threshold and cap", () => {
    for (let i = 1; i < GATE_TABLE.length; i++) {
      expect(GATE_TABLE[i][0]).toBeLessThan(GATE_TABLE[i - 1][0]);
      expect(GATE_TABLE[i][1]).toBeLessThan(GATE_TABLE[i - 1][1]);
    }
    expect(GATE_FLOOR_CAP).toBeLessThan(GATE_TABLE[GATE_TABLE.length - 1][1]);
  });
});

describe("projectSeason", () => {
  it("golden master: all-time roster clears every gate and wins ~80", () => {
    expect(project(ALL_TIME)).toEqual({
      wins: 80,
      losses: 2,
      ovr: 108.4,
      gatedCategory: null,
      winCap: 82,
    });
  });

  it("golden master: balanced roster wins 50–68 (exactly 53)", () => {
    expect(project(BALANCED)).toEqual({
      wins: 53,
      losses: 29,
      ovr: 87.1,
      gatedCategory: null,
      winCap: 82,
    });
  });

  it("golden master: all-centers roster is gated by free-throw shooting", () => {
    expect(project(ALL_CENTERS)).toEqual({
      wins: 59,
      losses: 23,
      ovr: 92.6,
      gatedCategory: "ftPct",
      winCap: 74,
    });
  });

  it("golden master: turnover-machine roster is hard-capped by tov despite high ovr", () => {
    const s = project(TURNOVER_PRONE);
    expect(s).toEqual({
      wins: 56,
      losses: 26,
      ovr: 97.6,
      gatedCategory: "tov",
      winCap: 56,
    });
    // The gate genuinely binds: the raw curve at this ovr exceeds the cap.
    const curve = Math.round(SEASON_GAMES * Math.pow(s.ovr / 110, 1.9));
    expect(curve).toBeGreaterThan(s.winCap);
  });

  it("a glaring weakness caps the record even at high OVR", () => {
    const s = project(TURNOVER_PRONE);
    expect(s.gatedCategory).not.toBeNull();
    expect(s.wins).toBeLessThanOrEqual(s.winCap);
    expect(s.winCap).toBeLessThan(SEASON_GAMES);
  });

  it("invariants across random rosters: wins ∈ [0, 82], wins + losses = 82, wins ≤ winCap", () => {
    for (const r of randomRosters(99, 500)) {
      const s = project(r);
      expect(s.wins).toBeGreaterThanOrEqual(0);
      expect(s.wins).toBeLessThanOrEqual(SEASON_GAMES);
      expect(s.wins + s.losses).toBe(SEASON_GAMES);
      expect(s.wins).toBeLessThanOrEqual(s.winCap);
      if (s.winCap === SEASON_GAMES) expect(s.gatedCategory).toBeNull();
      else expect(s.gatedCategory).not.toBeNull();
    }
  });

  it("gatedCategory is the binding (lowest-cap) category", () => {
    const tr = engine.teamRating(ALL_CENTERS, players, baselines);
    const s = engine.projectSeason(tr);
    const minCap = Math.min(
      ...Object.values(tr.catProfile).map((z) => gateCapFor(z))
    );
    expect(s.winCap).toBe(minCap);
    expect(gateCapFor(tr.catProfile[s.gatedCategory!])).toBe(minCap);
  });

  it("is a pure function of the rating", () => {
    const tr = engine.teamRating(ALL_TIME, players, baselines);
    expect(engine.projectSeason(tr)).toEqual(engine.projectSeason(tr));
  });
});
