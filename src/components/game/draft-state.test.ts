import { describe, expect, it } from "vitest";
import {
  DRAFT_ROUNDS,
  EXCLUDED_DECADES_PER_GAME,
  POSITIONS,
  RosterSchema,
} from "@/lib/contracts";
import { getSnapshot } from "@/lib/snapshot";
import {
  ALL_SLOTS,
  buildDraftContext,
  canSkipEra,
  canSkipTeam,
  deserializeGame,
  DraftContext,
  draftablePool,
  eligibleCombos,
  eligibleSlotsFor,
  gameReducer,
  GameAction,
  GameState,
  newGame,
  openSlots,
  pickablePool,
  rosterComplete,
  serializeGame,
  Slot,
  slotAccepts,
  toRoster,
} from "./draft-state";

const realCtx = buildDraftContext(getSnapshot());

/** Small synthetic context for precise eligibility/duplicate edge cases. */
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
  positionsById: {
    "kareem-AAA-1970s": ["C"],
    "oscar-AAA-1970s": ["PG"],
    "ray-AAA-1990s": ["SG"],
    "kareem-BBB-1980s": ["C"],
    "magic-BBB-1980s": ["PG", "SG"],
    "shaq-BBB-1990s": ["C"],
    "mj-CCC-1990s": ["SG", "SF"],
    "pippen-CCC-1990s": ["SF", "PF"],
  },
};

function dispatch(
  state: GameState,
  ctx: DraftContext,
  ...actions: GameAction[]
): GameState {
  return actions.reduce((s, a) => gameReducer(s, a, ctx), state);
}

/** Spin (skipping the reel), then draft the given player into the given slot. */
function draftInto(
  state: GameState,
  ctx: DraftContext,
  playerId: string,
  slot: Slot
): GameState {
  return dispatch(
    state,
    ctx,
    { type: "SELECT_PLAYER", playerId },
    { type: "PLACE", slot }
  );
}

describe("slotAccepts (hard roster requirements)", () => {
  it("starter slots demand the exact position", () => {
    expect(slotAccepts("PG", ["PG"])).toBe(true);
    expect(slotAccepts("PG", ["SG"])).toBe(false);
    expect(slotAccepts("C", ["C"])).toBe(true);
    expect(slotAccepts("C", ["PF"])).toBe(false);
    expect(slotAccepts("SF", ["SG", "SF"])).toBe(true); // alt position counts
  });

  it("bench G takes guards, F takes forwards, C takes centers", () => {
    expect(slotAccepts("BG", ["PG"])).toBe(true);
    expect(slotAccepts("BG", ["SG"])).toBe(true);
    expect(slotAccepts("BG", ["SF"])).toBe(false);
    expect(slotAccepts("BF", ["SF"])).toBe(true);
    expect(slotAccepts("BF", ["PF"])).toBe(true);
    expect(slotAccepts("BF", ["C"])).toBe(false);
    expect(slotAccepts("BC", ["C"])).toBe(true);
    expect(slotAccepts("BC", ["PF"])).toBe(false);
  });
});

describe("newGame", () => {
  it("excludes the right number of decades and stays spinnable", () => {
    const s = newGame(123, realCtx);
    expect(s.excludedDecades).toHaveLength(EXCLUDED_DECADES_PER_GAME);
    expect(eligibleCombos(s, realCtx).length).toBeGreaterThan(0);
    expect(openSlots(s)).toEqual([...ALL_SLOTS]);
  });

  it("is deterministic for a given seed", () => {
    expect(newGame(42, realCtx)).toEqual(newGame(42, realCtx));
    const a = dispatch(newGame(42, realCtx), realCtx, { type: "SPIN" });
    const b = dispatch(newGame(42, realCtx), realCtx, { type: "SPIN" });
    expect(a).toEqual(b);
  });
});

describe("SPIN", () => {
  it("never lands on an excluded decade, an empty pool, or a pool with no draftable player", () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = dispatch(newGame(seed, realCtx), realCtx, { type: "SPIN" });
      expect(s.spin).not.toBeNull();
      expect(s.excludedDecades).not.toContain(s.spin!.decade);
      expect(
        draftablePool(s, realCtx, s.spin!.franchiseId, s.spin!.decade).length
      ).toBeGreaterThan(0);
    }
  });

  it("is a no-op while a spin is pending", () => {
    const s = dispatch(newGame(1, realCtx), realCtx, { type: "SPIN" });
    expect(dispatch(s, realCtx, { type: "SPIN" })).toBe(s);
  });
});

describe("skips", () => {
  function spunGame(seed: number, ctx: DraftContext): GameState {
    return dispatch(newGame(seed, ctx), ctx, { type: "SPIN" });
  }

  it("SKIP_TEAM re-spins only the franchise and decrements once", () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = spunGame(seed, realCtx);
      if (!canSkipTeam(s, realCtx)) continue;
      const after = dispatch(s, realCtx, { type: "SKIP_TEAM" });
      expect(after.spin!.decade).toBe(s.spin!.decade);
      expect(after.spin!.franchiseId).not.toBe(s.spin!.franchiseId);
      expect(after.teamSkipsLeft).toBe(s.teamSkipsLeft - 1);
      expect(after.eraSkipsLeft).toBe(s.eraSkipsLeft);
    }
  });

  it("SKIP_ERA re-spins only the decade and decrements once", () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = spunGame(seed, realCtx);
      if (!canSkipEra(s, realCtx)) continue;
      const after = dispatch(s, realCtx, { type: "SKIP_ERA" });
      expect(after.spin!.franchiseId).toBe(s.spin!.franchiseId);
      expect(after.spin!.decade).not.toBe(s.spin!.decade);
      expect(after.eraSkipsLeft).toBe(s.eraSkipsLeft - 1);
    }
  });

  it("skips are exhausted after one use", () => {
    let s = spunGame(7, realCtx);
    if (canSkipTeam(s, realCtx)) {
      s = dispatch(s, realCtx, { type: "SKIP_TEAM" });
      expect(s.teamSkipsLeft).toBe(0);
      const again = dispatch(s, realCtx, { type: "SKIP_TEAM" });
      expect(again).toBe(s);
    }
  });
});

describe("SELECT_PLAYER + PLACE", () => {
  /** tiny game rigged onto a known spin. */
  function rigged(spin: { franchiseId: string; decade: string }): GameState {
    const s = newGame(5, tinyCtx);
    return {
      ...s,
      excludedDecades: [],
      spin: spin as GameState["spin"],
      spinNonce: 1,
    };
  }

  it("selects only draftable pool members and toggles off", () => {
    const s = rigged({ franchiseId: "BBB", decade: "1980s" });
    const sel = dispatch(s, tinyCtx, {
      type: "SELECT_PLAYER",
      playerId: "magic-BBB-1980s",
    });
    expect(sel.selectedPlayerId).toBe("magic-BBB-1980s");
    const toggled = dispatch(sel, tinyCtx, {
      type: "SELECT_PLAYER",
      playerId: "magic-BBB-1980s",
    });
    expect(toggled.selectedPlayerId).toBeNull();
    // Not in this pool:
    expect(
      dispatch(s, tinyCtx, { type: "SELECT_PLAYER", playerId: "mj-CCC-1990s" })
        .selectedPlayerId
    ).toBeNull();
  });

  it("places into an eligible slot, advances the round, clears spin + selection", () => {
    const s = rigged({ franchiseId: "BBB", decade: "1980s" });
    const placed = draftInto(s, tinyCtx, "magic-BBB-1980s", "PG");
    expect(placed.slots.PG).toBe("magic-BBB-1980s");
    expect(placed.picks).toEqual(["magic-BBB-1980s"]);
    expect(placed.round).toBe(2);
    expect(placed.spin).toBeNull();
    expect(placed.selectedPlayerId).toBeNull();
  });

  it("rejects ineligible slots: centers can't run point or back up the wing", () => {
    const s = rigged({ franchiseId: "BBB", decade: "1990s" });
    for (const slot of ["PG", "SG", "SF", "PF", "BG", "BF"] as const) {
      const attempt = draftInto(s, tinyCtx, "shaq-BBB-1990s", slot);
      expect(attempt.slots[slot]).toBeNull();
      expect(attempt.picks).toHaveLength(0);
    }
    const ok = draftInto(s, tinyCtx, "shaq-BBB-1990s", "BC");
    expect(ok.slots.BC).toBe("shaq-BBB-1990s");
  });

  it("rejects placing into an occupied slot", () => {
    let s = rigged({ franchiseId: "BBB", decade: "1980s" });
    s = draftInto(s, tinyCtx, "magic-BBB-1980s", "PG");
    s = { ...s, spin: { franchiseId: "AAA", decade: "1970s" } };
    const attempt = draftInto(s, tinyCtx, "oscar-AAA-1970s", "PG");
    expect(attempt.slots.PG).toBe("magic-BBB-1980s");
    expect(attempt.picks).toHaveLength(1);
    // BG still open for a guard:
    const ok = draftInto(s, tinyCtx, "oscar-AAA-1970s", "BG");
    expect(ok.slots.BG).toBe("oscar-AAA-1970s");
  });

  it("the same human can never be drafted twice, even from another era", () => {
    let s = rigged({ franchiseId: "AAA", decade: "1970s" });
    s = draftInto(s, tinyCtx, "kareem-AAA-1970s", "C");
    s = { ...s, spin: { franchiseId: "BBB", decade: "1980s" } };
    expect(pickablePool(s, tinyCtx, "BBB", "1980s")).not.toContain(
      "kareem-BBB-1980s"
    );
    const attempt = draftInto(s, tinyCtx, "kareem-BBB-1980s", "BC");
    expect(attempt.slots.BC).toBeNull();
  });

  it("eligibleSlotsFor shrinks as slots fill", () => {
    let s = rigged({ franchiseId: "BBB", decade: "1980s" });
    expect(eligibleSlotsFor("magic-BBB-1980s", s, tinyCtx).sort()).toEqual(
      ["BG", "PG", "SG"].sort()
    );
    s = draftInto(s, tinyCtx, "magic-BBB-1980s", "PG");
    s = { ...s, spin: { franchiseId: "AAA", decade: "1970s" } };
    expect(eligibleSlotsFor("oscar-AAA-1970s", s, tinyCtx).sort()).toEqual(
      ["BG"].sort()
    );
  });

  it("eligibleCombos drops pools whose players no longer fit any open slot", () => {
    let s = rigged({ franchiseId: "AAA", decade: "1990s" });
    // Fill every guard-compatible slot (SG via ray, PG+BG via oscar/magic).
    s = draftInto(s, tinyCtx, "ray-AAA-1990s", "SG");
    s = { ...s, spin: { franchiseId: "AAA", decade: "1970s" } };
    s = draftInto(s, tinyCtx, "oscar-AAA-1970s", "PG");
    s = { ...s, spin: { franchiseId: "BBB", decade: "1980s" } };
    s = draftInto(s, tinyCtx, "magic-BBB-1980s", "BG");
    // AAA 1990s (ray drafted) and AAA 1970s (oscar drafted, kareem fits C)…
    const combos = eligibleCombos(s, tinyCtx);
    // CCC 1990s wings still fit SF/PF/BF; BBB centers fit C/BC; AAA 1970s has kareem (C).
    expect(combos).toContainEqual({ franchiseId: "CCC", decade: "1990s" });
    expect(combos).toContainEqual({ franchiseId: "BBB", decade: "1990s" });
    expect(combos).toContainEqual({ franchiseId: "AAA", decade: "1970s" });
    // AAA 1990s is exhausted (its only player is drafted):
    expect(combos).not.toContainEqual({ franchiseId: "AAA", decade: "1990s" });
  });
});

describe("full draft on the real snapshot", () => {
  function playToCompletion(seed: number): GameState {
    let s = newGame(seed, realCtx);
    for (let guard = 0; guard < DRAFT_ROUNDS * 3 && s.status === "draft"; guard++) {
      s = gameReducer(s, { type: "SPIN" }, realCtx);
      const pool = draftablePool(s, realCtx, s.spin!.franchiseId, s.spin!.decade);
      // Greedy: first draftable player into their first eligible slot.
      const playerId = pool[0];
      const slot = eligibleSlotsFor(playerId, s, realCtx)[0];
      s = draftInto(s, realCtx, playerId, slot);
    }
    return s;
  }

  it("completes 8 rounds into a locked, contract-valid roster", () => {
    for (const seed of [1, 99, 4242]) {
      const s = playToCompletion(seed);
      expect(s.status).toBe("locked");
      expect(s.picks).toHaveLength(DRAFT_ROUNDS);
      expect(rosterComplete(s)).toBe(true);
      const roster = toRoster(s);
      expect(() => RosterSchema.parse(roster)).not.toThrow();
      expect(Object.keys(roster!.starters).sort()).toEqual([...POSITIONS].sort());
      expect(roster!.bench).toHaveLength(3);
      // Bench convention: [BG, BF, BC]
      expect(roster!.bench).toEqual([s.slots.BG, s.slots.BF, s.slots.BC]);
      // Every starter is a true fit for their slot (hard requirement):
      for (const pos of POSITIONS) {
        expect(realCtx.positionsById[roster!.starters[pos]]).toContain(pos);
      }
    }
  });

  it("actions after lock are no-ops", () => {
    const s = playToCompletion(1);
    expect(gameReducer(s, { type: "SPIN" }, realCtx)).toBe(s);
    expect(
      gameReducer(s, { type: "SELECT_PLAYER", playerId: s.picks[0] }, realCtx)
    ).toBe(s);
  });
});

describe("persistence", () => {
  it("round-trips through serialize/deserialize", () => {
    let s = dispatch(newGame(11, realCtx), realCtx, { type: "SPIN" });
    const pool = draftablePool(s, realCtx, s.spin!.franchiseId, s.spin!.decade);
    s = dispatch(s, realCtx, { type: "SELECT_PLAYER", playerId: pool[0] });
    expect(deserializeGame(serializeGame(s), realCtx)).toEqual(s);
  });

  it("rejects malformed payloads, wrong versions, and unknown players", () => {
    expect(deserializeGame(null, realCtx)).toBeNull();
    expect(deserializeGame("not json", realCtx)).toBeNull();
    const s = newGame(11, realCtx);
    expect(
      deserializeGame(
        serializeGame({ ...s, snapshotVersion: "other" }),
        realCtx
      )
    ).toBeNull();
    expect(
      deserializeGame(serializeGame({ ...s, picks: ["ghost-XXX-1990s"] }), realCtx)
    ).toBeNull();
  });
});
