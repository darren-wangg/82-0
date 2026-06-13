import { describe, expect, it } from "vitest";
import { NINE_CATS, OVR_MAX, Position, Roster } from "@/lib/contracts";
import { engine, positionFactor, POSITION_PENALTY } from "./index";
import {
  ALL_CENTERS,
  ALL_TIME,
  BALANCED,
  baselines,
  players,
  randomRosters,
} from "./test-helpers";

const rate = (r: Roster) => engine.teamRating(r, players, baselines);

describe("positionFactor", () => {
  const wilt = players.get("chambwi01-GSW-1960s")!; // C, no alts
  const magic = players.get("johnsma02-LAL-1980s")!; // PG, alts SG + PF

  it("is 1.0 at the primary position and at alt positions", () => {
    expect(positionFactor("C", wilt)).toBe(1.0);
    expect(positionFactor("PG", magic)).toBe(1.0);
    expect(positionFactor("SG", magic)).toBe(1.0);
    expect(positionFactor("PF", magic)).toBe(1.0);
  });

  it("penalizes by positional distance: adjacent mild, PG↔C harsh", () => {
    expect(positionFactor("PF", wilt)).toBe(POSITION_PENALTY[1]); // C → PF
    expect(positionFactor("SF", wilt)).toBe(POSITION_PENALTY[2]);
    expect(positionFactor("SG", wilt)).toBe(POSITION_PENALTY[3]);
    expect(positionFactor("PG", wilt)).toBe(POSITION_PENALTY[4]);
    expect(positionFactor("SF", magic)).toBe(POSITION_PENALTY[1]); // via SG alt
    expect(positionFactor("C", magic)).toBe(POSITION_PENALTY[1]); // via PF alt
  });

  it("penalties are monotone decreasing with distance", () => {
    for (let i = 1; i < POSITION_PENALTY.length; i++) {
      expect(POSITION_PENALTY[i]).toBeLessThan(POSITION_PENALTY[i - 1]);
    }
  });
});

describe("teamRating", () => {
  it("golden master: all-time roster pins the OVR ceiling", () => {
    const tr = rate(ALL_TIME);
    expect(tr.ovr).toBe(100);
    expect(tr.offRating).toBe(100);
    expect(tr.defRating).toBe(93.5);
    expect(tr.catProfile.pts).toBeCloseTo(3.592, 3);
    expect(tr.catProfile.tov).toBeCloseTo(-2.326, 3);
  });

  it("golden master: balanced roster lands in the strong-but-mortal band", () => {
    expect(rate(BALANCED).ovr).toBe(91);
  });

  it("golden master: all-centers roster is glass/rim dominant (great D, no spacing)", () => {
    const tr = rate(ALL_CENTERS);
    expect(tr.ovr).toBe(100);
    // Five rim protectors with no holes: weakest-link defense aggregation
    // rewards them, so the defensive sub-rating clears the offensive one.
    expect(tr.defRating).toBeGreaterThan(tr.offRating);
    expect(tr.catProfile.blk).toBeGreaterThan(2);
    expect(tr.catProfile.reb).toBeGreaterThan(2);
  });

  it("bounds: ovr ∈ [0, OVR_MAX], sub-ratings ∈ [0, 100] across random rosters", () => {
    for (const r of randomRosters(7, 250)) {
      const tr = rate(r);
      expect(tr.ovr).toBeGreaterThanOrEqual(0);
      expect(tr.ovr).toBeLessThanOrEqual(OVR_MAX);
      expect(tr.offRating).toBeGreaterThanOrEqual(0);
      expect(tr.offRating).toBeLessThanOrEqual(100);
      expect(tr.defRating).toBeGreaterThanOrEqual(0);
      expect(tr.defRating).toBeLessThanOrEqual(100);
      for (const cat of NINE_CATS) {
        expect(Number.isFinite(tr.catProfile[cat])).toBe(true);
      }
    }
  });

  it("an out-of-position starter never rates higher than the in-position lineup", () => {
    // Use the unclamped BALANCED roster (ALL_TIME sits at the OVR ceiling,
    // where penalties vanish into the clamp). Swap the point guard and the
    // center — both maximally out of position.
    const swapped: Roster = {
      ...BALANCED,
      starters: {
        ...BALANCED.starters,
        PG: BALANCED.starters.C!,
        C: BALANCED.starters.PG!,
      },
    };
    expect(rate(swapped).ovr).toBeLessThan(rate(BALANCED).ovr);
  });

  it("upgrading a bench player never lowers ovr", () => {
    const score = (id: string) =>
      engine.playerScore(engine.eraAdjust(players.get(id)!, baselines));
    const withBench = (id: string): Roster => ({
      ...BALANCED,
      bench: [BALANCED.bench[0], BALANCED.bench[1], id],
    });
    const candidates = ["havlijo01-BOS-1960s", "cowenda01-BOS-1970s", "westje01-LAL-1960s", "chambwi01-GSW-1960s"];
    const sorted = [...candidates].sort((a, b) => score(a) - score(b));
    let prev = -Infinity;
    for (const id of sorted) {
      const ovr = rate(withBench(id)).ovr;
      expect(ovr).toBeGreaterThanOrEqual(prev);
      prev = ovr;
    }
  });

  it("improving any single stat of any starter never lowers ovr", () => {
    const base = rate(BALANCED);
    for (const [slot, id] of Object.entries(BALANCED.starters) as [Position, string][]) {
      const p = players.get(id)!;
      for (const cat of NINE_CATS) {
        const improved = {
          ...p,
          stats: {
            ...p.stats,
            [cat]: cat === "tov" ? Math.max(0, p.stats.tov - 0.5) : p.stats[cat] + (cat.endsWith("Pct") ? 0.02 : 1),
          },
        };
        const patched = new Map(players);
        patched.set(id, improved);
        expect(engine.teamRating(BALANCED, patched, baselines).ovr).toBeGreaterThanOrEqual(base.ovr);
      }
      void slot;
    }
  });

  it("is deterministic and side-effect free", () => {
    expect(rate(ALL_TIME)).toEqual(rate(ALL_TIME));
  });
});

describe("construction model (concave aggregation)", () => {
  const adj = (id: string) => engine.eraAdjust(players.get(id)!, baselines);
  const mid = (xs: number[]) => (Math.min(...xs) + Math.max(...xs)) / 2;

  it("leans offense toward the best contributor and defense toward the weakest link", () => {
    const ids = [...Object.values(BALANCED.starters), ...BALANCED.bench];
    const tr = rate(BALANCED);
    // Best-direction (offense): the team value sits above the midpoint of the
    // players, pulled toward the top scorer.
    expect(tr.catProfile.pts).toBeGreaterThan(mid(ids.map((id) => adj(id).pts)));
    // Worst-direction (defense): pulled below the midpoint by the weakest
    // rim-protector — one non-shot-blocker drags the unit.
    expect(tr.catProfile.blk).toBeLessThan(mid(ids.map((id) => adj(id).blk)));
  });

  it("taxes redundancy: a second elite scorer adds less than the first", () => {
    // Fixed starters; add elite scorers one at a time into a uniformly
    // low-scoring bench. Order the two so the second can't outrank the first.
    // Because offense leans toward the best contributor, the second scorer
    // enters at a discount — stacking the same skill has diminishing returns.
    const [E1, E2] = ["jordami01-CHI-1990s", "curryst01-GSW-2010s"].sort(
      (a, b) => adj(b).pts - adj(a).pts
    );
    const lows = ["russebi01-BOS-1960s", "thurmna01-GSW-1960s", "reedwi01-NYK-1970s"];
    const pts = (bench: string[]) =>
      rate({ starters: BALANCED.starters, bench }).catProfile.pts;
    const gain1 = pts([E1, lows[1], lows[2]]) - pts(lows);
    const gain2 = pts([E1, E2, lows[2]]) - pts([E1, lows[1], lows[2]]);
    expect(gain1).toBeGreaterThan(0);
    expect(gain2).toBeLessThan(gain1);
  });
});
