/** GET /api/lobbies/[code]/live → compact LiveLobbyState for polling.
 *  No round-robin here (that runs only at results, via loadLobbyResponse). */

import { getAnonIdFromCookie } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { loadLiveLobbyState } from "../../../_lib/lobbies";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/live">
) {
  const { code } = await ctx.params;
  try {
    const anonId = await getAnonIdFromCookie();
    const state = await loadLiveLobbyState(code, anonId);
    if (!state) return jsonError(404, "Lobby not found");
    return Response.json(state);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Couldn't load this lobby right now");
    }
    throw err;
  }
}
