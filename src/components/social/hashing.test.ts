import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  explanationContentHash,
  LOBBY_CODE_ALPHABET,
  LOBBY_CODE_LENGTH,
  makeLobbyCode,
  makeTeamSlug,
  SLUG_ALPHABET,
  SLUG_LENGTH,
  stableSeed,
} from "./hashing";

describe("stableSeed", () => {
  it("is deterministic for the same ordered pair", () => {
    expect(stableSeed("abc12345", "xyz67890")).toBe(stableSeed("abc12345", "xyz67890"));
  });

  it("differs for different pairs", () => {
    expect(stableSeed("abc12345", "xyz67890")).not.toBe(stableSeed("abc12345", "qrs67890"));
  });

  it("is order-sensitive (A vs B has roles)", () => {
    expect(stableSeed("aaaa", "bbbb")).not.toBe(stableSeed("bbbb", "aaaa"));
  });

  it("fits a positive 32-bit int (Prisma Int column)", () => {
    for (const [a, b] of [
      ["x", "y"],
      ["longer-slug-1", "longer-slug-2"],
      ["", ""],
    ] as const) {
      const seed = stableSeed(a, b);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0x7fffffff);
    }
  });

  it("matches a frozen value (replays must stay identical across releases)", () => {
    // If this changes, every persisted matchup replays differently. Don't.
    expect(stableSeed("teamaaaa", "teambbbb")).toBe(998472749);
  });
});

describe("canonicalJson / explanationContentHash", () => {
  it("is stable under object key reordering", () => {
    const a = { wins: 70, ovr: 99.1, nested: { x: 1, y: 2 } };
    const b = { nested: { y: 2, x: 1 }, ovr: 99.1, wins: 70 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(explanationContentHash("team", a, "v1")).toBe(
      explanationContentHash("team", b, "v1")
    );
  });

  it("preserves array order", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("varies by kind, payload, and prompt version", () => {
    const payload = { ovr: 90 };
    const base = explanationContentHash("team", payload, "v1");
    expect(explanationContentHash("matchup", payload, "v1")).not.toBe(base);
    expect(explanationContentHash("team", { ovr: 91 }, "v1")).not.toBe(base);
    expect(explanationContentHash("team", payload, "v2")).not.toBe(base);
  });

  it("produces a 64-char hex sha256", () => {
    expect(explanationContentHash("team", { a: 1 }, "v1")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("slug / lobby code generation", () => {
  it("team slugs use the unambiguous alphabet at length 8", () => {
    for (let i = 0; i < 50; i++) {
      const slug = makeTeamSlug();
      expect(slug).toHaveLength(SLUG_LENGTH);
      for (const ch of slug) expect(SLUG_ALPHABET).toContain(ch);
    }
  });

  it("lobby codes use the uppercase alphabet at length 6", () => {
    for (let i = 0; i < 50; i++) {
      const code = makeLobbyCode();
      expect(code).toHaveLength(LOBBY_CODE_LENGTH);
      for (const ch of code) expect(LOBBY_CODE_ALPHABET).toContain(ch);
    }
  });

  it("alphabets exclude ambiguous characters", () => {
    for (const ch of "0O1lI") {
      expect(SLUG_ALPHABET).not.toContain(ch);
      expect(LOBBY_CODE_ALPHABET).not.toContain(ch);
    }
  });
});
