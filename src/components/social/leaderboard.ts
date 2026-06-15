/**
 * Pure leaderboard ordering/ranking. The DB query already orders and limits,
 * but this is the single source of truth for the sort and is unit-tested.
 */

import { LeaderboardEntry } from "@/lib/contracts";

export const LEADERBOARD_SIZE = 50;
/** Rows per leaderboard page (also the per-page DB fetch size). */
export const PAGE_SIZE = LEADERBOARD_SIZE;
export const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface LeaderboardTeamInput {
  teamSlug: string;
  teamName: string;
  displayName: string | null;
  wins: number;
  losses: number;
  ovr: number;
  /** True when the team belongs to the requesting device ("You"). */
  viewer?: boolean;
}

/**
 * Sort by wins desc, then ovr desc; assign ranks; cap at `limit`.
 * `rankOffset` continues ranks across pages (page 2 starts at 51, etc.) — the
 * caller passes the already-sliced page rows, so the local index is 0-based.
 */
export function rankLeaderboard(
  teams: LeaderboardTeamInput[],
  limit: number = LEADERBOARD_SIZE,
  rankOffset = 0
): LeaderboardEntry[] {
  return [...teams]
    .sort((a, b) => b.wins - a.wins || b.ovr - a.ovr)
    .slice(0, limit)
    .map((t, i) => ({
      rank: rankOffset + i + 1,
      teamSlug: t.teamSlug,
      teamName: t.teamName,
      displayName: t.displayName,
      wins: t.wins,
      losses: t.losses,
      ovr: t.ovr,
      ...(t.viewer ? { viewer: true } : {}),
    }));
}
