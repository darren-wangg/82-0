import { describe, expect, it } from "vitest";
import { parseTeamSlug } from "./parse-team-slug";

describe("parseTeamSlug", () => {
  it("passes through a raw slug", () => {
    expect(parseTeamSlug("abcd2345")).toBe("abcd2345");
    expect(parseTeamSlug("  abcd2345  ")).toBe("abcd2345");
  });

  it("extracts the slug from a full share link", () => {
    expect(parseTeamSlug("https://example.com/t/abcd2345")).toBe("abcd2345");
    expect(parseTeamSlug("https://example.com/t/abcd2345?utm=x#y")).toBe("abcd2345");
  });

  it("extracts the slug from a relative path", () => {
    expect(parseTeamSlug("/t/abcd2345")).toBe("abcd2345");
    expect(parseTeamSlug("/t/abcd2345/")).toBe("abcd2345");
  });

  it("returns empty string for empty input", () => {
    expect(parseTeamSlug("")).toBe("");
    expect(parseTeamSlug("   ")).toBe("");
  });
});
