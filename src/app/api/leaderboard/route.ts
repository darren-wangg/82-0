/**
 * GET /api/leaderboard?scope=global|weekly — top 50 teams by wins desc then
 * ovr desc, scoped to the current snapshot version. Weekly = teams created in
 * the last 7 days.
 */

import { LeaderboardResponse } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getSnapshot } from "@/lib/snapshot";
import {
  LEADERBOARD_SIZE,
  rankLeaderboard,
  WEEKLY_WINDOW_MS,
} from "@/components/social/leaderboard";
import { isDbUnavailable, jsonError, ownerDisplayName, teamInclude } from "../_lib/teams";

export async function GET(request: Request) {
  const scopeParam = new URL(request.url).searchParams.get("scope") ?? "global";
  if (scopeParam !== "global" && scopeParam !== "weekly") {
    return jsonError(400, "scope must be 'global' or 'weekly'");
  }
  const scope: "global" | "weekly" = scopeParam;
  const snapshotVersion = getSnapshot().version;

  try {
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

    const response: LeaderboardResponse = {
      scope,
      snapshotVersion,
      entries: rankLeaderboard(
        teams.map((t) => ({
          teamSlug: t.slug,
          teamName: t.teamName,
          displayName: ownerDisplayName(t),
          wins: t.wins,
          losses: t.losses,
          ovr: t.ovr,
        }))
      ),
    };
    return Response.json(response);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "The leaderboard is temporarily unavailable");
    }
    throw err;
  }
}
