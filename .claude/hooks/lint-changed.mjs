#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): lint just the file that changed.
//
// If ESLint reports errors, surface them to Claude (exit 2 → stderr is fed
// back) so they get fixed in the same turn, instead of piling up until the
// full-project gate. Scoped to TS/TSX under src|scripts and fails open on any
// infrastructure problem (missing npx, signal kill) so it never blocks work
// for a non-lint reason.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const filePath = String(input?.tool_input?.file_path ?? "");
const norm = filePath.replace(/\\/g, "/");

if (!/\.(ts|tsx)$/.test(norm)) process.exit(0);
if (!/\/(src|scripts)\//.test(norm)) process.exit(0);

const res = spawnSync("npx", ["eslint", filePath], {
  encoding: "utf8",
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
});

// Fail open: only block for an actual lint failure, never for a tooling error.
if (res.error || res.status === null || res.status === 0) process.exit(0);

const detail = `${res.stdout || ""}${res.stderr || ""}`.trim();
process.stderr.write(
  `ESLint flagged ${filePath}:\n${detail}\n\nFix these before moving on.\n`
);
process.exit(2);
