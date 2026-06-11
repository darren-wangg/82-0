/**
 * Shared leaderboard loader for the page and the API route. The DB query is
 * cached for 60s (keyed by scope + snapshot version) so leaderboard views
 * don't each pay a Postgres round trip; the per-device "viewer" flag is
 * applied AFTER cache retrieval, since it depends on the request cookie.
 */

import { unstable_cache } from "next/cache";
import { LeaderboardEntry } from "@/lib/contracts";
import { getAnonIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSnapshot } from "@/lib/snapshot";
import {
  LEADERBOARD_SIZE,
  rankLeaderboard,
  WEEKLY_WINDOW_MS,
} from "@/components/social/leaderboard";
import { ownerDisplayName, teamInclude } from "./teams";

interface CachedRow {
  teamSlug: string;
  teamName: string;
  displayName: string | null;
  wins: number;
  losses: number;
  ovr: number;
  /** Server-side only — compared against the caller's cookie, never sent. */
  anonIdentityId: string | null;
}

const loadRows = unstable_cache(
  async (scope: "global" | "weekly", snapshotVersion: string): Promise<CachedRow[]> => {
    const teams = await prisma.team.findMany({
      where: {
        snapshotVersion,
        ...(scope === "weekly"
          ? { createdAt: { gte: new Date(Date.now() - WEEKLY_WINDOW_MS) } }
          : {}),
      },
      orderBy: [{ wins: "desc" }, { ovr: "desc" }],
      take: LEADERBOARD_SIZE,
      include: teamInclude,
    });
    return teams.map((t) => ({
      teamSlug: t.slug,
      teamName: t.teamName,
      displayName: ownerDisplayName(t),
      wins: t.wins,
      losses: t.losses,
      ovr: t.ovr,
      anonIdentityId: t.anonIdentityId,
    }));
  },
  ["leaderboard-rows"],
  { revalidate: 60 }
);

export async function loadLeaderboardEntries(
  scope: "global" | "weekly"
): Promise<LeaderboardEntry[]> {
  const snapshotVersion = getSnapshot().version;
  // Read-only cookie check, outside the cached function.
  const anonId = await getAnonIdFromCookie();
  const rows = await loadRows(scope, snapshotVersion);
  // rankLeaderboard maps to the contract shape, dropping anonIdentityId.
  return rankLeaderboard(
    rows.map((r) => ({
      ...r,
      viewer: anonId !== null && r.anonIdentityId === anonId,
    }))
  );
}
