import { describe, expect, it } from "vitest";
import { rankLeaderboard } from "./leaderboard";

function entry(teamSlug: string, wins: number, ovr: number) {
  return {
    teamSlug,
    teamName: teamSlug.toUpperCase(),
    displayName: null,
    wins,
    losses: 82 - wins,
    ovr,
  };
}

describe("rankLeaderboard", () => {
  it("orders by wins desc, then ovr desc", () => {
    const ranked = rankLeaderboard([
      entry("aa", 60, 95.0),
      entry("bb", 70, 90.0),
      entry("cc", 70, 99.0),
      entry("dd", 50, 110.0),
    ]);
    expect(ranked.map((e) => e.teamSlug)).toEqual(["cc", "bb", "aa", "dd"]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
  });

  it("caps at the limit (top 50 by default)", () => {
    const many = Array.from({ length: 60 }, (_, i) => entry(`t${i}`, i, 50));
    const ranked = rankLeaderboard(many);
    expect(ranked).toHaveLength(50);
    expect(ranked[0].teamSlug).toBe("t59"); // most wins
    expect(ranked[0].rank).toBe(1);
    expect(ranked[49].rank).toBe(50);
  });

  it("does not mutate the input array", () => {
    const input = [entry("aa", 10, 50), entry("bb", 20, 60)];
    const before = [...input];
    rankLeaderboard(input);
    expect(input).toEqual(before);
  });

  it("carries losses and display fields through", () => {
    const ranked = rankLeaderboard([
      { ...entry("aa", 67, 96.4), displayName: "Hooper" },
    ]);
    expect(ranked[0]).toMatchObject({
      rank: 1,
      teamSlug: "aa",
      teamName: "AA",
      displayName: "Hooper",
      wins: 67,
      losses: 15,
      ovr: 96.4,
    });
  });
});
