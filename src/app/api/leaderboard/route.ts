/**
 * GET /api/leaderboard?scope=global|weekly — top 50 teams by wins desc then
 * ovr desc, scoped to the current snapshot version. Weekly = teams created in
 * the last 7 days. The underlying query is cached (see _lib/leaderboard);
 * entries belonging to the calling device carry `viewer: true`.
 */

import { LeaderboardResponse } from "@/lib/contracts";
import { getSnapshot } from "@/lib/snapshot";
import { resolveTeamSize } from "@/lib/team-size";
import { loadLeaderboardEntries } from "../_lib/leaderboard";
import { isDbUnavailable, jsonError } from "../_lib/teams";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopeParam = url.searchParams.get("scope") ?? "global";
  if (scopeParam !== "global" && scopeParam !== "weekly") {
    return jsonError(400, "scope must be 'global' or 'weekly'");
  }
  const scope: "global" | "weekly" = scopeParam;
  // ?size=5|8|10 picks the per-size board (defaults to 8).
  const teamSize = resolveTeamSize(url.searchParams.get("size"));

  try {
    const response: LeaderboardResponse = {
      scope,
      snapshotVersion: getSnapshot().version,
      entries: await loadLeaderboardEntries(scope, teamSize),
    };
    return Response.json(response);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "The leaderboard is temporarily unavailable");
    }
    throw err;
  }
}
