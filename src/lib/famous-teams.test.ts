/**
 * Unit tests for src/lib/famous-teams.ts.
 *
 * Validates every curated roster against the live snapshot:
 *   - all 8 player IDs exist in the snapshot,
 *   - exactly 5 starters + 3 bench,
 *   - slugs are stable and unique.
 */

import { describe, it, expect } from "vitest";
import { POSITIONS } from "@/lib/contracts";
import { getPlayerMap, getSnapshot } from "./snapshot";
import { FAMOUS_TEAMS } from "./famous-teams";

const snapshot = getSnapshot();
const players = getPlayerMap(snapshot);

describe("FAMOUS_TEAMS", () => {
  it("has at least 8 teams", () => {
    expect(FAMOUS_TEAMS.length).toBeGreaterThanOrEqual(8);
  });

  it("all slugs are unique and follow the 'famous-*' pattern", () => {
    const slugs = FAMOUS_TEAMS.map((t) => t.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^famous-/);
    }
  });

  for (const team of FAMOUS_TEAMS) {
    describe(`${team.slug} (${team.name})`, () => {
      const starterIds = Object.values(team.roster.starters);
      const allIds = [...starterIds, ...team.roster.bench];

      it("has exactly 5 starters and 3 bench players", () => {
        expect(starterIds).toHaveLength(5);
        expect(team.roster.bench).toHaveLength(3);
      });

      it("starters cover all 5 positions (PG, SG, SF, PF, C)", () => {
        const positions = Object.keys(team.roster.starters);
        for (const pos of POSITIONS) {
          expect(positions).toContain(pos);
        }
      });

      it("all 8 player IDs exist in snapshot-v1", () => {
        for (const id of allIds) {
          expect(
            players.has(id),
            `Player "${id}" not found in snapshot`
          ).toBe(true);
        }
      });

      it("has no duplicate player IDs", () => {
        const unique = new Set(allIds);
        expect(unique.size).toBe(allIds.length);
      });

      it("has non-empty name, era, and blurb", () => {
        expect(team.name.length).toBeGreaterThan(0);
        expect(team.era.length).toBeGreaterThan(0);
        expect(team.blurb.length).toBeGreaterThan(0);
      });
    });
  }
});
