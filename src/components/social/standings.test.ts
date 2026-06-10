import { describe, expect, it } from "vitest";
import { MatchupResult, NINE_CATS, NineCat, TeamRating } from "@/lib/contracts";
import { computeStandings, LobbyTeamInput } from "./standings";

/** Stub engine: higher OVR always wins; records the seeds it was called with. */
function stubEngine(seeds: number[] = []) {
  return {
    simulateMatchup(a: TeamRating, b: TeamRating, seed: number): MatchupResult {
      seeds.push(seed);
      const winner = a.ovr >= b.ovr ? "A" : "B";
      return {
        winner,
        seriesScore: winner === "A" ? [4, 1] : [1, 4],
        pGameA: a.ovr >= b.ovr ? 0.7 : 0.3,
        catBreakdown: [],
        seed,
      };
    },
  };
}

function team(slug: string, ovr: number): LobbyTeamInput {
  return {
    teamSlug: slug,
    teamName: slug.toUpperCase(),
    displayName: null,
    rating: {
      ovr,
      offRating: 50,
      defRating: 50,
      catProfile: Object.fromEntries(NINE_CATS.map((c) => [c, 0])) as Record<
        NineCat,
        number
      >,
    },
  };
}

describe("computeStandings", () => {
  it("plays a full round-robin: n*(n-1)/2 games", () => {
    const seeds: number[] = [];
    const standings = computeStandings(
      [team("aa", 90), team("bb", 80), team("cc", 70), team("dd", 60)],
      stubEngine(seeds)
    );
    expect(seeds).toHaveLength(6); // C(4,2)
    const totalWins = standings.reduce((s, t) => s + t.wins, 0);
    const totalLosses = standings.reduce((s, t) => s + t.losses, 0);
    expect(totalWins).toBe(6);
    expect(totalLosses).toBe(6);
  });

  it("ranks by wins desc with correct head-to-head records", () => {
    const standings = computeStandings(
      [team("low", 60), team("high", 95), team("mid", 80)],
      stubEngine()
    );
    expect(standings.map((s) => s.teamSlug)).toEqual(["high", "mid", "low"]);
    expect(standings[0]).toMatchObject({ wins: 2, losses: 0, ovr: 95 });
    expect(standings[1]).toMatchObject({ wins: 1, losses: 1, ovr: 80 });
    expect(standings[2]).toMatchObject({ wins: 0, losses: 2, ovr: 60 });
  });

  it("breaks win ties by ovr desc", () => {
    // Rock-paper-scissors stub: everyone ends 1-1; order must follow ovr.
    const beats: Record<string, string> = { a: "b", b: "c", c: "a" };
    const cyclical = {
      simulateMatchup(a: TeamRating, b: TeamRating, seed: number): MatchupResult {
        // identify teams by ovr (88 = a, 77 = b, 66 = c)
        const name = (r: TeamRating) => (r.ovr === 88 ? "a" : r.ovr === 77 ? "b" : "c");
        const winner = beats[name(a)] === name(b) ? "A" : "B";
        return {
          winner,
          seriesScore: winner === "A" ? [4, 2] : [2, 4],
          pGameA: 0.5,
          catBreakdown: [],
          seed,
        };
      },
    };
    const standings = computeStandings(
      [team("c", 66), team("a", 88), team("b", 77)],
      cyclical
    );
    expect(standings.every((s) => s.wins === 1 && s.losses === 1)).toBe(true);
    expect(standings.map((s) => s.teamSlug)).toEqual(["a", "b", "c"]);
  });

  it("uses the injected stable seed per pairing", () => {
    const seeds: number[] = [];
    computeStandings(
      [team("aa", 90), team("bb", 80)],
      stubEngine(seeds),
      (x, y) => x.length * 1000 + y.length
    );
    expect(seeds).toEqual([2002]);
  });

  it("handles empty and single-team lobbies", () => {
    expect(computeStandings([], stubEngine())).toEqual([]);
    const solo = computeStandings([team("aa", 90)], stubEngine());
    expect(solo).toHaveLength(1);
    expect(solo[0]).toMatchObject({ wins: 0, losses: 0 });
  });
});
