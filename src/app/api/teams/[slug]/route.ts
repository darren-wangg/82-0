/** GET /api/teams/[slug] → SavedTeam */

import { isDbUnavailable, jsonError, loadSavedTeam } from "../../_lib/teams";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/teams/[slug]">
) {
  const { slug } = await ctx.params;
  try {
    const team = await loadSavedTeam(slug);
    if (!team) return jsonError(404, "Team not found");
    return Response.json(team);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Couldn't load this team right now");
    }
    throw err;
  }
}
