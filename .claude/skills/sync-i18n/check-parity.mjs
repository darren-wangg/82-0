#!/usr/bin/env node
// Verify every message catalog has the exact same set of key paths as en.json.
// Exits 1 and lists offenders on any mismatch; otherwise prints a green line.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const msgDir = join(root, "messages");

const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flat(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );

const load = (loc) =>
  new Set(flat(JSON.parse(readFileSync(join(msgDir, `${loc}.json`), "utf8"))));

const locales = readdirSync(msgDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const ref = "en";
const refKeys = load(ref);
let ok = true;

for (const loc of locales) {
  if (loc === ref) continue;
  const keys = load(loc);
  const missing = [...refKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !refKeys.has(k));
  if (missing.length || extra.length) {
    ok = false;
    console.error(`✗ ${loc}.json`);
    if (missing.length) console.error(`   missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`   extra:   ${extra.join(", ")}`);
  }
}

if (!ok) process.exit(1);
console.log(
  `✓ all ${locales.length} catalogs match ${ref}.json (${refKeys.size} keys)`
);
