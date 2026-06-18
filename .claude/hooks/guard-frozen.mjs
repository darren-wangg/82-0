#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): protect 82-0's frozen contract surface.
//
// src/lib/contracts.ts holds every shared type, zod schema, the engine API and
// all route payloads — AGENTS.md marks it FROZEN ("build to it, never edit it").
// This hook denies edits to that one file so the rule can't be violated by
// accident, by me, or by any subagent. Intentional contract changes are still
// possible: re-run with ALLOW_CONTRACTS_EDIT=1 in the environment.

import { readFileSync } from "node:fs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // no/invalid stdin — nothing to guard
}

const filePath = String(input?.tool_input?.file_path ?? "");
const norm = filePath.replace(/\\/g, "/");

const FROZEN = "src/lib/contracts.ts";
const isFrozen = norm.endsWith("/" + FROZEN) || norm === FROZEN;

if (isFrozen && process.env.ALLOW_CONTRACTS_EDIT !== "1") {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "src/lib/contracts.ts is FROZEN (AGENTS.md hard rule). Build to the " +
          "contract instead of editing it. If this change is genuinely " +
          "intentional, re-run the session with ALLOW_CONTRACTS_EDIT=1 set.",
      },
    })
  );
}

process.exit(0);
