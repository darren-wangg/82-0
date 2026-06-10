import { describe, expect, it } from "vitest";
import {
  DRAFT_ROUNDS,
  EXCLUDED_DECADES_PER_GAME,
  POSITIONS,
  RosterSchema,
  Decade,
  Position,
} from "@/lib/contracts";
import { getSnapshot } from "@/lib/snapshot";
import {
  buildDraftContext,
  canSkipEra,
  canSkipTeam,
  deserializeGame,
  DraftContext,
  eligibleCombos,
  gameReducer,
  GameAction,
  GameState,
  lineupComplete,
  newGame,
  pickablePool,
  serializeGame,
  toRoster,
  unassignedPicks,
} from "./draft-state";

const fixtureCtx = buildDraftContext(getSnapshot());

/** Small synthetic snapshot context for precise duplicate/edge-case tests. */
const tinyCtx: DraftContext = {
  snapshotVersion: "tiny",
  pools: {
    AAA: {
      "1970s": ["kareem-AAA-1970s", "oscar-AAA-1970s"],
      "1990s": ["ray-AAA-1990s"],
    },
    BBB: {
      "1980s": ["kareem-BBB-1980s", "magic-BBB-1980s"],
      "1990s": ["shaq-BBB-1990s"],
      "1960s": [], // empty pool must never be spinnable
    },
    CCC: {
      "1990s": ["mj-CCC-1990s", "pippen-CCC-1990s"],
    },
  },
  slugById: {
    "kareem-AAA-1970s": "abdulka01",
    "oscar-AAA-1970s": "robero01",
    "ray-AAA-1990s": "allenra02",
    "kareem-BBB-1980s": "abdulka01", // same human, different franchise/era
    "magic-BBB-1980s": "johnsma02",
    "shaq-BBB-1990s": "onealsh01",
    "mj-CCC-1990s": "jordami01",
    "pippen-CCC-1990s": "pippesc01",
  },
};

function dispatch(state: GameState, ctx: DraftContext, ...actions: GameAction[]) {
  return actions.reduce((s, a) => gameReducer(s, a, ctx), state);
}

/** newGame for tinyCtx with no excluded decades (full control in tests). */
function tinyGame(seed = 1): GameState {
  return { ...newGame(seed, tinyCtx), excludedDecades: [] };
}

function forceSpin(state: GameState, franchiseId: string, decade: Decade): GameState {
  return { ...state, spin: { franchiseId, decade } };
}

describe("newGame", () => {
  it("excludes exactly EXCLUDED_DECADES_PER_GAME distinct decades", () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = newGame(seed, fixtureCtx);
      expect(s.excludedDecades).toHaveLength(EXCLUDED_DECADES_PER_GAME);
      expect(new Set(s.excludedDecades).size).toBe(EXCLUDED_DECADES_PER_GAME);
      expect(eligibleCombos(s, fixtureCtx).length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for a given seed", () => {
    expect(newGame(42, fixtureCtx)).toEqual(newGame(42, fixtureCtx));
  });
});

describe("SPIN", () => {
  it("never lands on an excluded decade or an empty/unpickable pool", () => {
    for (let seed = 0; seed < 200; seed++) {
      const s0 = newGame(seed, fixtureCtx);
      const s1 = gameReducer(s0, { type: "SPIN" }, fixtureCtx);
      expect(s1.spin).not.toBeNull();
      expect(s0.excludedDecades).not.toContain(s1.spin!.decade);
      expect(
        pickablePool(s1, fixtureCtx, s1.spin!.franchiseId, s1.spin!.decade).length
      ).toBeGreaterThan(0);
    }
  });

  it("ignores SPIN while a spin result is pending", () => {
    const s1 = dispatch(newGame(7, fixtureCtx), fixtureCtx, { type: "SPIN" });
    expect(gameReducer(s1, { type: "SPIN" }, fixtureCtx)).toBe(s1);
  });

  it("never offers a combo whose pool is fully drafted by slug", () => {
    // Draft tiny-ctx Kareem from AAA-1970s; BBB-1980s still has Magic, but if
    // Magic is drafted too the BBB-1980s combo must disappear entirely.
    let s = forceSpin(tinyGame(), "AAA", "1970s");
    s = gameReducer(s, { type: "PICK", playerId: "kareem-AAA-1970s" }, tinyCtx);
    s = forceSpin(s, "BBB", "1980s");
    s = gameReducer(s, { type: "PICK", playerId: "magic-BBB-1980s" }, tinyCtx);
    const combos = eligibleCombos(s, tinyCtx);
    expect(combos).not.toContainEqual({ franchiseId: "BBB", decade: "1980s" });
    // empty pools are never eligible either
    expect(combos).not.toContainEqual({ franchiseId: "BBB", decade: "1960s" });
  });
});

describe("skips", () => {
  it("team skip re-rolls only the franchise and decrements teamSkipsLeft", () => {
    for (let seed = 0; seed < 100; seed++) {
      const s1 = dispatch(newGame(seed, fixtureCtx), fixtureCtx, { type: "SPIN" });
      if (!canSkipTeam(s1, fixtureCtx)) continue;
      const s2 = gameReducer(s1, { type: "SKIP_TEAM" }, fixtureCtx);
      expect(s2.spin!.decade).toBe(s1.spin!.decade);
      expect(s2.spin!.franchiseId).not.toBe(s1.spin!.franchiseId);
      expect(s2.teamSkipsLeft).toBe(s1.teamSkipsLeft - 1);
      expect(s2.eraSkipsLeft).toBe(s1.eraSkipsLeft);
    }
  });

  it("era skip re-rolls only the decade, avoiding excluded decades", () => {
    for (let seed = 0; seed < 100; seed++) {
      const s1 = dispatch(newGame(seed, fixtureCtx), fixtureCtx, { type: "SPIN" });
      if (!canSkipEra(s1, fixtureCtx)) continue;
      const s2 = gameReducer(s1, { type: "SKIP_ERA" }, fixtureCtx);
      expect(s2.spin!.franchiseId).toBe(s1.spin!.franchiseId);
      expect(s2.spin!.decade).not.toBe(s1.spin!.decade);
      expect(s2.excludedDecades).not.toContain(s2.spin!.decade);
      expect(s2.eraSkipsLeft).toBe(s1.eraSkipsLeft - 1);
      expect(s2.teamSkipsLeft).toBe(s1.teamSkipsLeft);
    }
  });

  it("skips are no-ops once exhausted", () => {
    const s1 = dispatch(newGame(3, fixtureCtx), fixtureCtx, { type: "SPIN" });
    const drained = { ...s1, teamSkipsLeft: 0, eraSkipsLeft: 0 };
    expect(gameReducer(drained, { type: "SKIP_TEAM" }, fixtureCtx)).toBe(drained);
    expect(gameReducer(drained, { type: "SKIP_ERA" }, fixtureCtx)).toBe(drained);
  });

  it("era skip is a no-op when the franchise has no other eligible decade", () => {
    // CCC only has 1990s, so an era skip has nowhere to go.
    const s = forceSpin(tinyGame(), "CCC", "1990s");
    expect(canSkipEra(s, tinyCtx)).toBe(false);
    const after = gameReducer(s, { type: "SKIP_ERA" }, tinyCtx);
    expect(after.spin).toEqual(s.spin);
    expect(after.eraSkipsLeft).toBe(s.eraSkipsLeft);
  });
});

describe("PICK", () => {
  it("rejects drafting the same human (playerSlug) from a different era", () => {
    let s = forceSpin(tinyGame(), "AAA", "1970s");
    s = gameReducer(s, { type: "PICK", playerId: "kareem-AAA-1970s" }, tinyCtx);
    expect(s.picks).toEqual(["kareem-AAA-1970s"]);

    const s2 = forceSpin(s, "BBB", "1980s");
    expect(pickablePool(s2, tinyCtx, "BBB", "1980s")).toEqual(["magic-BBB-1980s"]);
    const rejected = gameReducer(
      s2,
      { type: "PICK", playerId: "kareem-BBB-1980s" },
      tinyCtx
    );
    expect(rejected.picks).toEqual(s2.picks); // unchanged
  });

  it("rejects players outside the spun pool and without a pending spin", () => {
    const s0 = tinyGame();
    expect(
      gameReducer(s0, { type: "PICK", playerId: "mj-CCC-1990s" }, tinyCtx).picks
    ).toHaveLength(0);
    const s1 = forceSpin(s0, "AAA", "1970s");
    expect(
      gameReducer(s1, { type: "PICK", playerId: "mj-CCC-1990s" }, tinyCtx).picks
    ).toHaveLength(0);
  });

  it("advances the round and clears the spin after a valid pick", () => {
    const s1 = dispatch(newGame(11, fixtureCtx), fixtureCtx, { type: "SPIN" });
    const id = pickablePool(s1, fixtureCtx, s1.spin!.franchiseId, s1.spin!.decade)[0];
    const s2 = gameReducer(s1, { type: "PICK", playerId: id }, fixtureCtx);
    expect(s2.round).toBe(2);
    expect(s2.spin).toBeNull();
    expect(s2.picks).toEqual([id]);
  });
});

/** Plays spin → first-available-pick until the draft completes. */
function playDraft(seed: number, ctx: DraftContext): GameState {
  let s = newGame(seed, ctx);
  for (let guard = 0; guard < DRAFT_ROUNDS * 2 && s.status === "draft"; guard++) {
    s = gameReducer(s, { type: "SPIN" }, ctx);
    const pool = pickablePool(s, ctx, s.spin!.franchiseId, s.spin!.decade);
    s = gameReducer(s, { type: "PICK", playerId: pool[0] }, ctx);
  }
  return s;
}

describe("full game", () => {
  it("completes 8 rounds with 8 unique players and unique humans", () => {
    for (let seed = 0; seed < 25; seed++) {
      const s = playDraft(seed, fixtureCtx);
      expect(s.status).toBe("lineup");
      expect(s.picks).toHaveLength(DRAFT_ROUNDS);
      expect(new Set(s.picks).size).toBe(DRAFT_ROUNDS);
      const slugs = s.picks.map((id) => fixtureCtx.slugById[id]);
      expect(new Set(slugs).size).toBe(DRAFT_ROUNDS);
    }
  });

  it("assigning 5 starters + 3 bench enables LOCK and yields a valid Roster", () => {
    let s = playDraft(5, fixtureCtx);
    expect(gameReducer(s, { type: "LOCK" }, fixtureCtx).status).toBe("lineup"); // incomplete
    s.picks.forEach((id, i) => {
      const target =
        i < 5
          ? ({ kind: "starter", position: POSITIONS[i] } as const)
          : ({ kind: "bench", index: i - 5 } as const);
      s = gameReducer(s, { type: "ASSIGN", playerId: id, target }, fixtureCtx);
    });
    expect(lineupComplete(s)).toBe(true);
    expect(unassignedPicks(s)).toHaveLength(0);
    s = gameReducer(s, { type: "LOCK" }, fixtureCtx);
    expect(s.status).toBe("locked");
    const roster = toRoster(s);
    expect(roster).not.toBeNull();
    expect(() => RosterSchema.parse(roster)).not.toThrow();
    expect(Object.keys(roster!.starters)).toHaveLength(5);
  });

  it("ASSIGN to an occupied slot swaps the two players", () => {
    let s = playDraft(9, fixtureCtx);
    const [a, b] = s.picks;
    const pg = { kind: "starter", position: "PG" as Position } as const;
    const sg = { kind: "starter", position: "SG" as Position } as const;
    s = dispatch(
      s,
      fixtureCtx,
      { type: "ASSIGN", playerId: a, target: pg },
      { type: "ASSIGN", playerId: b, target: sg },
      { type: "ASSIGN", playerId: b, target: pg } // swap into a's slot
    );
    expect(s.starters.PG).toBe(b);
    expect(s.starters.SG).toBe(a);
  });

  it("ASSIGN is rejected during the draft phase and for non-drafted players", () => {
    const s = newGame(1, fixtureCtx);
    const t = { kind: "starter", position: "C" as Position } as const;
    expect(gameReducer(s, { type: "ASSIGN", playerId: "x", target: t }, fixtureCtx)).toBe(s);
  });
});

describe("determinism & persistence", () => {
  it("replays identically: same seed + same actions → same state", () => {
    const run = () =>
      playDraft(123, fixtureCtx);
    expect(run()).toEqual(run());
  });

  it("skip-then-pick sequences are replayable too", () => {
    const run = () => {
      let s = newGame(77, fixtureCtx);
      s = dispatch(s, fixtureCtx, { type: "SPIN" }, { type: "SKIP_TEAM" }, { type: "SKIP_ERA" });
      const pool = pickablePool(s, fixtureCtx, s.spin!.franchiseId, s.spin!.decade);
      return gameReducer(s, { type: "PICK", playerId: pool[0] }, fixtureCtx);
    };
    expect(run()).toEqual(run());
  });

  it("serialize → deserialize round-trips mid-game state", () => {
    let s = dispatch(newGame(31, fixtureCtx), fixtureCtx, { type: "SPIN" });
    const pool = pickablePool(s, fixtureCtx, s.spin!.franchiseId, s.spin!.decade);
    s = gameReducer(s, { type: "PICK", playerId: pool[0] }, fixtureCtx);
    const restored = deserializeGame(serializeGame(s), fixtureCtx);
    expect(restored).toEqual(s);
  });

  it("rejects corrupt payloads and snapshot-version mismatches", () => {
    expect(deserializeGame(null, fixtureCtx)).toBeNull();
    expect(deserializeGame("not json", fixtureCtx)).toBeNull();
    expect(deserializeGame('{"hello":1}', fixtureCtx)).toBeNull();
    const s = newGame(2, fixtureCtx);
    const wrongVersion = serializeGame({ ...s, snapshotVersion: "other" });
    expect(deserializeGame(wrongVersion, fixtureCtx)).toBeNull();
    const ghostPick = serializeGame({ ...s, picks: ["no-such-player"] });
    expect(deserializeGame(ghostPick, fixtureCtx)).toBeNull();
  });
});
