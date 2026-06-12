/**
 * Anonymous-first identity: a signed httpOnly cookie maps the device to an
 * AnonIdentity row. Teams, lobby creation, and lobby entries all key off it.
 *
 * Sign-in (Google via Auth.js) was removed from the runtime — the User/
 * Account/Session tables and Team.userId remain in the schema so re-adding
 * accounts later is additive, but nothing writes them today.
 */

import { cookies } from "next/headers";
import { prisma } from "./db";
import { signAnonId, verifyAnonToken } from "@/components/social/anon-token";

export const ANON_COOKIE_NAME = "anon_id";
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function anonSecret(): string {
  const secret = process.env.ANON_COOKIE_SECRET ?? process.env.AUTH_SECRET;
  if (secret) return secret;
  // A known signing secret would let anyone forge anon identities (and claim
  // other devices' teams) — never fall back silently in production.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (or ANON_COOKIE_SECRET) must be set in production"
    );
  }
  // Dev-only fallback so the game works before secrets are provisioned.
  return "82-0-dev-insecure-anon-secret";
}

/**
 * Reads the signed anon cookie without touching the database.
 * Returns the anon id or null if absent/invalid.
 */
export async function getAnonIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return verifyAnonToken(store.get(ANON_COOKIE_NAME)?.value, anonSecret());
}

/**
 * Returns the device's AnonIdentity id, creating the row and setting the
 * signed httpOnly cookie when needed. Must be called from a Route Handler or
 * Server Action (cookie writes are not allowed during page rendering).
 */
export async function getOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = verifyAnonToken(store.get(ANON_COOKIE_NAME)?.value, anonSecret());

  if (existing) {
    // Make sure the row still exists (cookie can outlive a reset database).
    const row = await prisma.anonIdentity.findUnique({ where: { id: existing } });
    if (row) return existing;
  }

  const created = await prisma.anonIdentity.create({ data: {} });
  store.set(ANON_COOKIE_NAME, signAnonId(created.id, anonSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE,
  });
  return created.id;
}
