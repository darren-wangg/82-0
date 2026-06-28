import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NINE_CATS, type NineCat, type Roster } from "@/lib/contracts";
import type { PlayerStatLine } from "@/lib/contracts";
import {
  avgEraYear,
  describeProfile,
  draftKey,
  readProfile,
  recordDraft,
  type DraftFeatures,
} from "./draft-memory";

// Minimal localStorage stub — the module runs in the browser; the node test
// env has no window, so back it with a Map for the round-trip cases.
function installStorage() {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

function flatCats(v: number): Record<NineCat, number> {
  return Object.fromEntries(NINE_CATS.map((c) => [c, v])) as Record<
    NineCat,
    number
  >;
}

function features(over: Partial<DraftFeatures> = {}): DraftFeatures {
  return {
    key: Math.random().toString(36),
    wins: 50,
    off: 100,
    def: 100,
    avgYear: 1995,
    catProfile: flatCats(0),
    ...over,
  };
}

describe("draftKey / avgEraYear", () => {
  const roster: Roster = {
    starters: { PG: "a", SG: "b", SF: "c", PF: "d", C: "e" },
    bench: ["f", "g", "h"],
  };

  it("draftKey is order-independent and stable", () => {
    expect(draftKey(roster)).toBe("a,b,c,d,e,f,g,h");
  });

  it("avgEraYear parses decade labels and ignores unknowns", () => {
    const players = new Map<string, PlayerStatLine>([
      ["a", { decade: "1990s" } as PlayerStatLine],
      ["b", { decade: "2010s" } as PlayerStatLine],
    ]);
    const mini: Roster = { starters: { ...roster.starters, PG: "a", SG: "b" }, bench: [] };
    // a=1990, b=2010, c/d/e missing → averaged over the 2 known.
    expect(avgEraYear(mini, players)).toBe(2000);
  });
});

describe("describeProfile", () => {
  it("returns null below the minimum draft count", () => {
    expect(describeProfile(null)).toBeNull();
  });

  it("names era, build lean, favored cats, and form", () => {
    installStorage();
    // Three drafts: modern era, offense-heavy, strong threes+assists, rising wins.
    recordDraft(
      features({
        key: "1",
        wins: 30,
        off: 110,
        def: 100,
        avgYear: 2015,
        catProfile: { ...flatCats(0), tpm: 2, ast: 1.5 },
      })
    );
    recordDraft(
      features({
        key: "2",
        wins: 40,
        off: 112,
        def: 100,
        avgYear: 2016,
        catProfile: { ...flatCats(0), tpm: 2, ast: 1.5 },
      })
    );
    recordDraft(
      features({
        key: "3",
        wins: 70,
        off: 111,
        def: 100,
        avgYear: 2018,
        catProfile: { ...flatCats(0), tpm: 2, ast: 1.5 },
      })
    );
    const blurb = describeProfile(readProfile());
    expect(blurb).toContain("modern-era");
    expect(blurb).toContain("offense-first");
    expect(blurb).toContain("threes");
    expect(blurb).toContain("trending up");
  });
});

describe("recordDraft", () => {
  beforeEach(installStorage);

  it("is idempotent for a repeated draft key", () => {
    recordDraft(features({ key: "same" }));
    recordDraft(features({ key: "same" }));
    expect(readProfile()?.drafts).toBe(1);
  });

  it("accumulates distinct drafts and caps recent wins at 6", () => {
    for (let i = 0; i < 8; i++) {
      recordDraft(features({ key: `k${i}`, wins: i }));
    }
    const p = readProfile()!;
    expect(p.drafts).toBe(8);
    expect(p.recentWins).toEqual([2, 3, 4, 5, 6, 7]);
  });
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});
