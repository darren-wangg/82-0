import { describe, expect, it } from "vitest";
import { lobbyPhase } from "./lobbies";

describe("lobbyPhase", () => {
  const base = {
    isLive: false,
    startedAt: null,
    closedAt: null,
  };

  it("returns results when closedAt is set (async lobby)", () => {
    expect(lobbyPhase({ ...base, closedAt: new Date() })).toBe("results");
  });

  it("returns results when closedAt is set (live lobby)", () => {
    expect(
      lobbyPhase({ isLive: true, startedAt: new Date(), closedAt: new Date() })
    ).toBe("results");
  });

  it("returns drafting for an open async lobby (isLive=false)", () => {
    expect(lobbyPhase({ ...base })).toBe("drafting");
  });

  it("returns waiting for a live lobby that hasn't started", () => {
    expect(lobbyPhase({ isLive: true, startedAt: null, closedAt: null })).toBe(
      "waiting"
    );
  });

  it("returns drafting for a live lobby that has started but not closed", () => {
    expect(
      lobbyPhase({ isLive: true, startedAt: new Date(), closedAt: null })
    ).toBe("drafting");
  });

  it("closedAt takes priority over startedAt=null (edge case: direct close)", () => {
    expect(
      lobbyPhase({ isLive: true, startedAt: null, closedAt: new Date() })
    ).toBe("results");
  });
});
