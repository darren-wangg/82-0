/**
 * Signed anonymous-identity cookie value: `${anonId}.${hmac}`.
 * Pure functions (secret passed in) so they can be unit-tested.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_LENGTH = 32; // hex chars of the hmac we keep

function signature(anonId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(anonId, "utf8")
    .digest("hex")
    .slice(0, SIGNATURE_LENGTH);
}

export function signAnonId(anonId: string, secret: string): string {
  return `${anonId}.${signature(anonId, secret)}`;
}

/** Returns the anon id if the token is valid, otherwise null. */
export function verifyAnonToken(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const anonId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = signature(anonId, secret);
  if (provided.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))) {
      return null;
    }
  } catch {
    return null;
  }
  return anonId;
}
