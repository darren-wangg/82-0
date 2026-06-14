import { describe, expect, it } from "vitest";
import { containsProfanity } from "./profanity";

describe("containsProfanity", () => {
  it("flags plain profanity and slurs", () => {
    for (const s of ["fuck", "Shit Talkers", "the BITCHES", "faggot", "nigger"]) {
      expect(containsProfanity(s)).toBe(true);
    }
  });

  it("catches leetspeak and spacing/separator obfuscation", () => {
    for (const s of ["f u c k", "sh1t", "f.u.c.k", "b!tch", "n i g g e r"]) {
      expect(containsProfanity(s)).toBe(true);
    }
  });

  it("ignores accents/case", () => {
    expect(containsProfanity("FÚCK")).toBe(true);
  });

  it("does not flag innocent names (avoids the Scunthorpe problem)", () => {
    for (const s of [
      "Bass Brothers",
      "Shell Shock",
      "Cassidy's Squad",
      "Spice Girls",
      "Kike", // common Spanish nickname for Enrique
      "Assassins",
      "Document Crew",
      "Class of 96",
    ]) {
      expect(containsProfanity(s)).toBe(false);
    }
  });

  it("handles empty and symbol-only input", () => {
    expect(containsProfanity("")).toBe(false);
    expect(containsProfanity("🏀🔥")).toBe(false);
  });
});
