import { describe, it, expect } from "vitest";
import {
  lobbyPhase,
  JoinLobbyBodySchema,
  DraftProgressBodySchema,
  FinishLobbyBodySchema,
} from "./live-lobby";

describe("lobbyPhase", () => {
  it("is 'waiting' before the creator starts", () => {
    expect(lobbyPhase({ startedAt: null, closedAt: null })).toBe("waiting");
  });

  it("is 'drafting' once started and not yet closed", () => {
    expect(lobbyPhase({ startedAt: new Date(), closedAt: null })).toBe("drafting");
  });

  it("is 'results' once closed, regardless of startedAt", () => {
    expect(lobbyPhase({ startedAt: new Date(), closedAt: new Date() })).toBe("results");
    // closedAt wins even if (pathologically) startedAt is null.
    expect(lobbyPhase({ startedAt: null, closedAt: new Date() })).toBe("results");
  });
});

describe("live-lobby request schemas", () => {
  it("JoinLobby requires a 1–24 char trimmed name", () => {
    expect(JoinLobbyBodySchema.safeParse({ displayName: "Ada" }).success).toBe(true);
    expect(JoinLobbyBodySchema.safeParse({ displayName: "  " }).success).toBe(false);
    expect(JoinLobbyBodySchema.safeParse({ displayName: "x".repeat(25) }).success).toBe(false);
  });

  it("DraftProgress takes an int pick count in [0, 10]", () => {
    expect(DraftProgressBodySchema.safeParse({ picksCount: 0 }).success).toBe(true);
    expect(DraftProgressBodySchema.safeParse({ picksCount: 8 }).success).toBe(true);
    expect(DraftProgressBodySchema.safeParse({ picksCount: 11 }).success).toBe(false);
    expect(DraftProgressBodySchema.safeParse({ picksCount: 1.5 }).success).toBe(false);
  });

  it("FinishLobby requires a teamSlug; displayName optional", () => {
    expect(FinishLobbyBodySchema.safeParse({ teamSlug: "abc" }).success).toBe(true);
    expect(
      FinishLobbyBodySchema.safeParse({ teamSlug: "abc", displayName: "Ada" }).success
    ).toBe(true);
    expect(FinishLobbyBodySchema.safeParse({ displayName: "Ada" }).success).toBe(false);
  });
});
