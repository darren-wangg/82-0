import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./config";

type Json = Record<string, unknown>;

function load(locale: string): Json {
  return JSON.parse(
    readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8")
  );
}

function flatKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatKeys(v as Json, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

const tags = {
  b: (c: unknown) => c,
  red: (c: unknown) => c,
  mono: (c: unknown) => c,
  muted: (c: unknown) => c,
  amber: (c: unknown) => c,
  link: (c: unknown) => c,
};

/** The messages with non-trivial ICU (placeholders, plural, select, tags),
 *  with sample values, exercised in every locale. */
const RICH_CASES: { key: string; values: Record<string, unknown> }[] = [
  { key: "home.tagline", values: { size: 8, ...tags } },
  { key: "home.attribution", values: { ...tags } },
  { key: "play.countOf", values: { current: 1, total: 8 } },
  { key: "sim.gateCapped", values: { cat: "X", wins: 74, ...tags } },
  { key: "sim.costGatedLost", values: { cat: "X", winsLost: 1, culprit: "P", z: "-1.2", ...tags } },
  { key: "sim.costGatedLost", values: { cat: "X", winsLost: 5, culprit: "P", z: "-1.2", ...tags } },
  { key: "sim.costGatedCaps", values: { cat: "X", winCap: 66, culprit: "P", z: "-1.2", ...tags } },
  { key: "sim.costWeakLink", values: { player: "P", slot: "PG", bench: "yes", oop: "no", ...tags } },
  { key: "sim.costWeakLink", values: { player: "P", slot: "PG", bench: "no", oop: "yes", ...tags } },
  { key: "howToPlay.steps.reSpins.body", values: { teamSkips: 1, eraSkips: 1 } },
  { key: "lobby.manCount", values: { size: 10 } },
];

const en = load("en");
const enKeys = new Set(flatKeys(en));

describe("message catalogs", () => {
  it.each(LOCALES)("%s has exact key parity with en", (locale) => {
    const keys = new Set(flatKeys(load(locale)));
    expect([...enKeys].filter((k) => !keys.has(k))).toEqual([]);
    expect([...keys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it.each(LOCALES)("%s formats every rich/plural/select message", (locale) => {
    // Loosely typed: next-intl infers literal message keys, but this test
    // iterates dynamic keys with mixed values.
    const t = createTranslator({ locale, messages: load(locale) }) as unknown as {
      rich: (key: string, values: Record<string, unknown>) => unknown;
    };
    for (const { key, values } of RICH_CASES) {
      expect(() => t.rich(key, values)).not.toThrow();
    }
  });
});
