import { describe, expect, it } from "vitest";
import { Roster } from "@/lib/contracts";
import { getPlayerMap } from "@/lib/snapshot";
import { validateRoster } from "./validation";

const players = getPlayerMap();

const validRoster: Roster = {
  starters: {
    PG: "johnsma02-LAL-1980s",
    SG: "jordami01-CHI-1990s",
    SF: "birdla01-BOS-1980s",
    PF: "duncati01-SAS-2000s",
    C: "chambwi01-GSW-1960s",
  },
  bench: ["curryst01-GSW-2010s", "olajuha01-HOU-1990s", "jokicni01-DEN-2020s"],
};

describe("validateRoster", () => {
  it("accepts a valid 5+3 roster and returns all 8 ids", () => {
    const result = validateRoster(validRoster, players);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.playerIds).toHaveLength(8);
  });

  it("rejects a missing starter position", () => {
    const starters: Partial<Roster["starters"]> = { ...validRoster.starters };
    delete starters.C;
    const roster = { ...validRoster, starters } as Roster;
    const result = validateRoster(roster, players);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/starter at C/);
  });

  it("accepts a 5-man roster (empty bench) when 0 is an allowed count", () => {
    const roster: Roster = { ...validRoster, bench: [] };
    const result = validateRoster(roster, players, { benchCounts: [0, 3, 5] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.playerIds).toHaveLength(5);
  });

  it("rejects an empty bench under the default (8-man) count", () => {
    const roster: Roster = { ...validRoster, bench: [] };
    const result = validateRoster(roster, players);
    expect(result.ok).toBe(false);
  });

  it("rejects a short bench", () => {
    const roster: Roster = {
      ...validRoster,
      bench: validRoster.bench.slice(0, 2),
    };
    const result = validateRoster(roster, players);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/exactly 3/);
  });

  it("rejects unknown player ids", () => {
    const roster: Roster = {
      ...validRoster,
      bench: ["curryst01-GSW-2010s", "olajuha01-HOU-1990s", "fake-id-0000"],
    };
    const result = validateRoster(roster, players);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/fake-id-0000/);
  });

  it("rejects the same entry used twice", () => {
    const roster: Roster = {
      ...validRoster,
      bench: ["curryst01-GSW-2010s", "curryst01-GSW-2010s", "jokicni01-DEN-2020s"],
    };
    const result = validateRoster(roster, players);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/duplicate/i);
  });

  it("rejects the same player from two different eras (duplicate playerSlug)", () => {
    // Kareem exists as MIL-1970s and LAL-1980s in the fixture snapshot.
    const roster: Roster = {
      ...validRoster,
      starters: { ...validRoster.starters, C: "abdulka01-MIL-1970s" },
      bench: ["abdulka01-LAL-1980s", "olajuha01-HOU-1990s", "jokicni01-DEN-2020s"],
    };
    const result = validateRoster(roster, players);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/abdulka01/);
  });
});
