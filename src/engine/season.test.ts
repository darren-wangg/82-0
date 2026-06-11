import { describe, expect, it } from "vitest";
import { NINE_CATS, NineCat, Roster, SEASON_GAMES } from "@/lib/contracts";
import {
  engine,
  GATE_FLOOR_CAP,
  gateCapFor,
  GATE_STEPS,
  GATE_THRESHOLDS,
} from "./index";
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
  it("maps team z to graduated win caps relative to each cat's threshold", () => {
    for (const cat of NINE_CATS) {
      const t = GATE_THRESHOLDS[cat];
      expect(gateCapFor(cat, t + 1)).toBe(SEASON_GAMES);
      expect(gateCapFor(cat, t)).toBe(SEASON_GAMES);
      expect(gateCapFor(cat, t - 0.1)).toBe(78);
      expect(gateCapFor(cat, t - 0.3)).toBe(74);
      expect(gateCapFor(cat, t - 0.6)).toBe(66);
      expect(gateCapFor(cat, t - 1.0)).toBe(56);
      expect(gateCapFor(cat, t - 5)).toBe(GATE_FLOOR_CAP);
    }
  });

  it("gate steps are sorted strictly by offset and cap", () => {
    for (let i = 1; i < GATE_STEPS.length; i++) {
      expect(GATE_STEPS[i][0]).toBeLessThan(GATE_STEPS[i - 1][0]);
      expect(GATE_STEPS[i][1]).toBeLessThan(GATE_STEPS[i - 1][1]);
    }
    expect(GATE_FLOOR_CAP).toBeLessThan(GATE_STEPS[GATE_STEPS.length - 1][1]);
  });

  it("the tov threshold sits below the star tax but above a deliberate stack", () => {
    // All-star teams inherently run negative tov z (~ -0.9 median for drafted
    // rosters); the gate must not punish that, only true turnover machines.
    expect(GATE_THRESHOLDS.tov).toBeLessThan(-1.57); // drafted p05
  });
});

describe("projectSeason", () => {
  it("golden master: all-time roster clears every gate and goes 82-0", () => {
    expect(project(ALL_TIME)).toEqual({
      wins: 82,
      losses: 0,
      ovr: 100,
      gatedCategory: null,
      winCap: 82,
    });
  });

  it("golden master: balanced roster lands in the strong-but-mortal band (74-8)", () => {
    expect(project(BALANCED)).toEqual({
      wins: 74,
      losses: 8,
      ovr: 91,
      gatedCategory: null,
      winCap: 82,
    });
  });

  it("golden master: all-centers roster is gated by free-throw shooting", () => {
    expect(project(ALL_CENTERS)).toEqual({
      wins: 78,
      losses: 4,
      ovr: 100,
      gatedCategory: "ftPct",
      winCap: 78,
    });
  });

  it("golden master: turnover-machine roster is hard-capped by tov despite high ovr", () => {
    const s = project(TURNOVER_PRONE);
    expect(s).toEqual({
      wins: 78,
      losses: 4,
      ovr: 100,
      gatedCategory: "tov",
      winCap: 78,
    });
    // The gate genuinely binds: the raw curve at this ovr exceeds the cap.
    expect(s.winCap).toBeLessThan(SEASON_GAMES);
    expect(s.wins).toBe(s.winCap);
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
      ...NINE_CATS.map((cat) => gateCapFor(cat, tr.catProfile[cat]))
    );
    expect(s.winCap).toBe(minCap);
    expect(gateCapFor(s.gatedCategory as NineCat, tr.catProfile[s.gatedCategory!])).toBe(
      minCap
    );
  });

  it("is a pure function of the rating", () => {
    const tr = engine.teamRating(ALL_TIME, players, baselines);
    expect(engine.projectSeason(tr)).toEqual(engine.projectSeason(tr));
  });
});
