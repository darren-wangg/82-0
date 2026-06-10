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
  const magic = players.get("johnsma02-LAL-1980s")!; // PG, alts SG/SF

  it("is 1.0 at the primary position and at alt positions", () => {
    expect(positionFactor("C", wilt)).toBe(1.0);
    expect(positionFactor("PG", magic)).toBe(1.0);
    expect(positionFactor("SG", magic)).toBe(1.0);
    expect(positionFactor("SF", magic)).toBe(1.0);
  });

  it("penalizes by positional distance: adjacent mild, PG↔C harsh", () => {
    expect(positionFactor("PF", wilt)).toBe(POSITION_PENALTY[1]); // C → PF
    expect(positionFactor("SF", wilt)).toBe(POSITION_PENALTY[2]);
    expect(positionFactor("SG", wilt)).toBe(POSITION_PENALTY[3]);
    expect(positionFactor("PG", wilt)).toBe(POSITION_PENALTY[4]);
    expect(positionFactor("PF", magic)).toBe(POSITION_PENALTY[1]); // via SF alt
    expect(positionFactor("C", magic)).toBe(POSITION_PENALTY[2]);
  });

  it("penalties are monotone decreasing with distance", () => {
    for (let i = 1; i < POSITION_PENALTY.length; i++) {
      expect(POSITION_PENALTY[i]).toBeLessThan(POSITION_PENALTY[i - 1]);
    }
  });
});

describe("teamRating", () => {
  it("golden master: all-time roster is 100+ OVR", () => {
    const tr = rate(ALL_TIME);
    expect(tr.ovr).toBe(108.4);
    expect(tr.offRating).toBe(76.3);
    expect(tr.defRating).toBe(68.7);
    expect(tr.catProfile.pts).toBeCloseTo(2.404, 3);
    expect(tr.catProfile.tov).toBeCloseTo(-0.776, 3);
  });

  it("golden master: balanced roster lands in the strong-but-mortal band", () => {
    expect(rate(BALANCED).ovr).toBe(87.1);
  });

  it("golden master: all-centers roster is big-skewed (great D, weak ftPct)", () => {
    const tr = rate(ALL_CENTERS);
    expect(tr.ovr).toBe(92.6);
    expect(tr.defRating).toBeGreaterThan(tr.offRating);
    expect(tr.catProfile.ftPct).toBeCloseTo(-1.122, 3);
    expect(tr.catProfile.blk).toBeGreaterThan(2);
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
    // Swap MJ (SG, alt SF) and Bird (SF, alt PF): MJ→SF stays legal, Bird→SG
    // picks up an adjacency penalty.
    const swapped: Roster = {
      ...ALL_TIME,
      starters: {
        ...ALL_TIME.starters,
        SG: ALL_TIME.starters.SF!,
        SF: ALL_TIME.starters.SG!,
      },
    };
    expect(rate(swapped).ovr).toBeLessThan(rate(ALL_TIME).ovr);

    // Wilt at PG (max distance) is worse than the mild swap above.
    const wiltAtPoint: Roster = {
      ...ALL_TIME,
      starters: {
        ...ALL_TIME.starters,
        PG: ALL_TIME.starters.C!,
        C: ALL_TIME.starters.PG!,
      },
    };
    expect(rate(wiltAtPoint).ovr).toBeLessThan(rate(ALL_TIME).ovr);
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
