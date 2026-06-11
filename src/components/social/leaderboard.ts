/**
 * Pure leaderboard ordering/ranking. The DB query already orders and limits,
 * but this is the single source of truth for the sort and is unit-tested.
 */

import { LeaderboardEntry } from "@/lib/contracts";

export const LEADERBOARD_SIZE = 50;
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

/** Sort by wins desc, then ovr desc; assign 1-based ranks; cap at `limit`. */
export function rankLeaderboard(
  teams: LeaderboardTeamInput[],
  limit: number = LEADERBOARD_SIZE
): LeaderboardEntry[] {
  return [...teams]
    .sort((a, b) => b.wins - a.wins || b.ovr - a.ovr)
    .slice(0, limit)
    .map((t, i) => ({
      rank: i + 1,
      teamSlug: t.teamSlug,
      teamName: t.teamName,
      displayName: t.displayName,
      wins: t.wins,
      losses: t.losses,
      ovr: t.ovr,
      ...(t.viewer ? { viewer: true } : {}),
    }));
}
