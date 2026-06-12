/**
 * Auth.js v5 (next-auth@beta) configuration: Google sign-in backed by the
 * Prisma adapter, plus an anonymous-first identity model.
 *
 * Anonymous identity: a signed httpOnly cookie maps the device to an
 * AnonIdentity row. Teams are always created with the anon identity; when the
 * user signs in with Google, the signIn event links AnonIdentity.userId and
 * claims the anonymous teams for the user.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The generated client lives in src/generated/prisma (Prisma 7 custom
  // output); the adapter's parameter type is written against the default
  // "@prisma/client" location, so a cast is required. Shapes are identical.
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers: [Google],
  session: { strategy: "database" },
  trustHost: true,
  events: {
    async signIn({ user }) {
      // Claim the device's anonymous identity (and its teams) for this user.
      try {
        if (user?.id) await linkAnonIdentityToUser(user.id);
      } catch {
        // Never block sign-in on the linking step (e.g. DB hiccup).
      }
    },
  },
});

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

/**
 * Links the current device's anonymous identity to a user and claims any
 * teams created anonymously. Safe to call repeatedly.
 */
export async function linkAnonIdentityToUser(userId: string): Promise<void> {
  const anonId = await getAnonIdFromCookie();
  if (!anonId) return;

  const anon = await prisma.anonIdentity.findUnique({ where: { id: anonId } });
  if (!anon || (anon.userId && anon.userId !== userId)) return;

  await prisma.$transaction([
    prisma.anonIdentity.update({ where: { id: anonId }, data: { userId } }),
    prisma.team.updateMany({
      where: { anonIdentityId: anonId, userId: null },
      data: { userId },
    }),
  ]);
}
