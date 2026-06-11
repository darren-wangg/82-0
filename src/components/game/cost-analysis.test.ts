import { describe, expect, it } from "vitest";
import { Roster, SEASON_GAMES } from "@/lib/contracts";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getPlayerMap } from "@/lib/snapshot";
import { analyzeCost } from "./cost-analysis";

const players = getPlayerMap();
const baselines = getBaselines();
const engine = getEngine();

function analyze(roster: Roster) {
  const rating = engine.teamRating(roster, players, baselines);
  const season = engine.projectSeason(rating);
  return { rating, season, result: analyzeCost(roster, rating, season, players, baselines) };
}

/** All-time greats: 82-0, nothing cost them anything. */
const ALL_TIME: Roster = {
  starters: {
    PG: "johnsma02-LAL-1980s",
    SG: "jordami01-CHI-1990s",
    SF: "birdla01-BOS-1980s",
    PF: "duncati01-SAS-2000s",
    C: "chambwi01-GSW-1960s",
  },
  bench: ["curryst01-GSW-2010s", "olajuha01-HOU-1990s", "jokicni01-DEN-2020s"],
};

/** Five centers, several wildly out of position — gated by ftPct. */
const ALL_CENTERS: Roster = {
  starters: {
    PG: "onealsh01-LAL-2000s",
    SG: "malonmo01-PHI-1980s",
    SF: "thurmna01-GSW-1960s",
    PF: "russebi01-BOS-1960s",
    C: "chambwi01-GSW-1960s",
  },
  bench: ["reedwi01-NYK-1970s", "abdulka01-LAL-1980s", "embiijo01-PHI-2020s"],
};

/** Strong but mortal: ungated, short of 82 wins. */
const BALANCED: Roster = {
  starters: {
    PG: "fraziwa01-NYK-1970s",
    SG: "wadedw01-MIA-2000s",
    SF: "leonaka01-SAS-2010s",
    PF: "malonka01-UTA-1990s",
    C: "reedwi01-NYK-1970s",
  },
  bench: ["ervinju01-PHI-1970s", "tatumja01-BOS-2020s", "nashst01-PHX-2000s"],
};

describe("analyzeCost", () => {
  it("returns null for a perfect season", () => {
    const { season, result } = analyze(ALL_TIME);
    expect(season.wins).toBe(SEASON_GAMES);
    expect(result).toBeNull();
  });

  it("gated season: reports the gate's cost and the worst player in the cat", () => {
    const { season, result } = analyze(ALL_CENTERS);
    expect(season.gatedCategory).toBe("ftPct");
    expect(result).not.toBeNull();
    if (result?.kind !== "gated") throw new Error("expected gated analysis");
    expect(result.cat).toBe("ftPct");
    expect(result.winCap).toBe(season.winCap);
    // OVR pins the ceiling, so every missing win is the gate's fault.
    expect(result.winsLost).toBe(SEASON_GAMES - season.wins);
    expect(result.winsLost).toBeGreaterThan(0);
    // The culprit is genuinely the roster's worst era-adjusted FT shooter.
    const ids = [...Object.values(ALL_CENTERS.starters), ...ALL_CENTERS.bench];
    const worst = Math.min(
      ...ids.map((id) => engine.eraAdjust(players.get(id)!, baselines).ftPct)
    );
    expect(result.culprit.z).toBe(worst);
    expect(result.culprit.z).toBeLessThan(0);
  });

  it("ungated season: names the weakest starter by playerScore", () => {
    const { season, result } = analyze(BALANCED);
    expect(season.gatedCategory).toBeNull();
    expect(season.wins).toBeLessThan(SEASON_GAMES);
    expect(result).not.toBeNull();
    if (result?.kind !== "weakest") throw new Error("expected weakest analysis");
    const scores = Object.entries(BALANCED.starters).map(([, id]) =>
      engine.playerScore(engine.eraAdjust(players.get(id)!, baselines))
    );
    const playerScore = engine.playerScore(
      engine.eraAdjust(result.player, baselines)
    );
    expect(playerScore).toBe(Math.min(...scores));
    // Everyone in BALANCED mans a natural position.
    expect(result.outOfPosition).toBe(false);
  });

  it("flags an out-of-position weakest starter", () => {
    // Swap Frazier (PG) and Reed (C): both end up maximally out of position.
    const swapped: Roster = {
      ...BALANCED,
      starters: {
        ...BALANCED.starters,
        PG: BALANCED.starters.C!,
        C: BALANCED.starters.PG!,
      },
    };
    const { result } = analyze(swapped);
    expect(result).not.toBeNull();
    if (result?.kind !== "weakest") throw new Error("expected weakest analysis");
    expect(result.outOfPosition).toBe(true);
  });
});
