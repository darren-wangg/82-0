import { describe, expect, it } from "vitest";
import { signAnonId, verifyAnonToken } from "./anon-token";

const SECRET = "test-secret";

describe("anon token signing", () => {
  it("round-trips a signed id", () => {
    const token = signAnonId("anon_abc123", SECRET);
    expect(verifyAnonToken(token, SECRET)).toBe("anon_abc123");
  });

  it("rejects a tampered id", () => {
    const token = signAnonId("anon_abc123", SECRET);
    const [, sig] = token.split(".");
    expect(verifyAnonToken(`anon_evil99.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signAnonId("anon_abc123", SECRET);
    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyAnonToken(flipped, SECRET)).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signAnonId("anon_abc123", "other-secret");
    expect(verifyAnonToken(token, SECRET)).toBeNull();
  });

  it("rejects missing/malformed tokens", () => {
    expect(verifyAnonToken(undefined, SECRET)).toBeNull();
    expect(verifyAnonToken("", SECRET)).toBeNull();
    expect(verifyAnonToken("no-dot-here", SECRET)).toBeNull();
    expect(verifyAnonToken(".justasig", SECRET)).toBeNull();
  });

  it("handles ids containing dots (cuid-safe either way)", () => {
    const token = signAnonId("weird.id.with.dots", SECRET);
    expect(verifyAnonToken(token, SECRET)).toBe("weird.id.with.dots");
  });
});
