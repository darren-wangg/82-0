/**
 * Pure hashing / id-generation helpers for the social backend.
 * No DB or framework imports — unit-testable in isolation.
 */

import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";

/** Unambiguous alphabet: no 0/O, 1/l/I — safe to read aloud or retype. */
export const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SLUG_LENGTH = 8;

/** Lobby join codes: same idea, uppercase for a "code" feel. */
export const LOBBY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LOBBY_CODE_LENGTH = 6;

export const makeTeamSlug = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);
export const makeLobbyCode = customAlphabet(LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH);

/**
 * Deterministic 32-bit seed for a matchup pairing. The same ordered pair of
 * slugs always produces the same seed, so a pairing always replays
 * identically. FNV-1a over `${slugA}|${slugB}`, folded to a positive int31.
 */
export function stableSeed(slugA: string, slugB: string): number {
  const input = `${slugA}|${slugB}`;
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // Fold to a non-negative int31 so it fits Prisma's Int column.
  return (hash >>> 0) & 0x7fffffff;
}

/** JSON.stringify with object keys sorted recursively (arrays keep order). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Cache key for an AI explanation: hash of the kind, the canonicalized
 * structured engine output it was generated from, and the prompt version.
 */
export function explanationContentHash(
  kind: "team" | "matchup",
  payload: unknown,
  promptVersion: string
): string {
  return sha256Hex(`${kind}:${canonicalJson(payload)}:${promptVersion}`);
}
