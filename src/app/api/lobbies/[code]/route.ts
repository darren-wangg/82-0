/** GET /api/lobbies/[code] → LobbyResponse with round-robin standings. */

import { isDbUnavailable, jsonError } from "../../_lib/teams";
import { loadLobbyResponse } from "../../_lib/lobbies";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lobbies/[code]">
) {
  const { code } = await ctx.params;
  try {
    const lobby = await loadLobbyResponse(code);
    if (!lobby) return jsonError(404, "Lobby not found");
    return Response.json(lobby);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Couldn't load this lobby right now");
    }
    throw err;
  }
}
