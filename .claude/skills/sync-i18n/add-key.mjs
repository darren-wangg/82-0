#!/usr/bin/env node
// Add or overwrite one translation key across every message catalog.
//
// Usage:
//   node add-key.mjs <dotted.key.path> '{"en":"…","es":"…", …}'
//
// The JSON object must supply a value for every locale present in messages/.
// Files are rewritten with 2-space indentation and a trailing newline to keep
// diffs minimal.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const msgDir = join(root, "messages");

const [keyPath, valuesJson] = process.argv.slice(2);
if (!keyPath || !valuesJson) {
  console.error('Usage: node add-key.mjs <dotted.key> \'{"en":"…", …}\'');
  process.exit(1);
}

let values;
try {
  values = JSON.parse(valuesJson);
} catch {
  console.error("Second argument must be valid JSON.");
  process.exit(1);
}

const locales = readdirSync(msgDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const missing = locales.filter((l) => !(l in values));
if (missing.length) {
  console.error(`Missing a translation for: ${missing.join(", ")}`);
  process.exit(1);
}

const parts = keyPath.split(".");
for (const loc of locales) {
  const file = join(msgDir, `${loc}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  let node = json;
  for (const p of parts.slice(0, -1)) {
    if (typeof node[p] !== "object" || node[p] === null) node[p] = {};
    node = node[p];
  }
  node[parts.at(-1)] = values[loc];
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}

console.log(`Set ${keyPath} in ${locales.length} catalogs.`);
