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
  PAGE_SIZE,
  rankLeaderboard,
  WEEKLY_WINDOW_MS,
} from "@/components/social/leaderboard";
import { ownerDisplayName, teamInclude } from "./teams";

/** Per-size, snapshot-scoped board filter (shared by the page query + count). */
function boardWhere(
  scope: "global" | "weekly",
  snapshotVersion: string,
  teamSize: number,
  mode?: string,
  difficulty?: string
) {
  return {
    snapshotVersion,
    // Every board is size-scoped — sizes aren't ranked against each other.
    // Classic uses 5 / 8 / 10; budget uses 6 / 8 (each with its own caps), so
    // the caller passes the budget roster size as teamSize for budget boards.
    teamSize,
    // Preset famous teams never appear on any leaderboard.
    isPreset: false,
    // Mode filter: null/undefined means "classic" boards (exclude budget);
    // "budget" means budget-only for the given difficulty.
    ...(mode === "budget"
      ? { mode: "budget", ...(difficulty ? { difficulty } : {}) }
      : { mode: null }),
    ...(scope === "weekly"
      ? { createdAt: { gte: new Date(Date.now() - WEEKLY_WINDOW_MS) } }
      : {}),
  };
}

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
  async (
    scope: "global" | "weekly",
    snapshotVersion: string,
    teamSize: number,
    page: number,
    mode?: string,
    difficulty?: string
  ): Promise<CachedRow[]> => {
    const teams = await prisma.team.findMany({
      where: boardWhere(scope, snapshotVersion, teamSize, mode, difficulty),
      orderBy: [{ wins: "desc" }, { ovr: "desc" }],
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
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
  // Tagged so claiming a team can bust the cache immediately.
  { revalidate: 60, tags: ["leaderboard-rows", "leaderboard-budget"] }
);

const countRows = unstable_cache(
  async (
    scope: "global" | "weekly",
    snapshotVersion: string,
    teamSize: number,
    mode?: string,
    difficulty?: string
  ): Promise<number> =>
    prisma.team.count({
      where: boardWhere(scope, snapshotVersion, teamSize, mode, difficulty),
    }),
  ["leaderboard-count"],
  { revalidate: 60, tags: ["leaderboard-rows", "leaderboard-budget"] }
);

export async function loadLeaderboardEntries(
  scope: "global" | "weekly",
  teamSize: number,
  page = 0,
  mode?: string,
  difficulty?: string
): Promise<LeaderboardEntry[]> {
  const snapshotVersion = getSnapshot().version;
  // Read-only cookie check, outside the cached function.
  const anonId = await getAnonIdFromCookie();
  const rows = await loadRows(scope, snapshotVersion, teamSize, page, mode, difficulty);
  // rankLeaderboard maps to the contract shape, dropping anonIdentityId.
  // Ranks continue across pages (page 1 → 51-100, etc.).
  return rankLeaderboard(
    rows.map((r) => ({
      ...r,
      viewer: anonId !== null && r.anonIdentityId === anonId,
    })),
    PAGE_SIZE,
    page * PAGE_SIZE
  );
}

/** Total board size for the current snapshot/size — drives the page count. */
export async function loadLeaderboardCount(
  scope: "global" | "weekly",
  teamSize: number,
  mode?: string,
  difficulty?: string
): Promise<number> {
  return countRows(scope, getSnapshot().version, teamSize, mode, difficulty);
}
