/** POST /api/lobbies/[code]/close — the creator ends the lobby early,
 *  closing entries and crowning the current standings leader. */

import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { loadLobbyResponse, lobbyIsOpen } from "../../../_lib/lobbies";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/close">
) {
  const { code } = await ctx.params;
  try {
    const lobby = await prisma.lobby.findUnique({ where: { code } });
    if (!lobby) return jsonError(404, "Lobby not found");

    const anonId = await getAnonIdFromCookie();
    if (!lobby.creatorAnonId || lobby.creatorAnonId !== anonId) {
      return jsonError(403, "Only the lobby creator can end it");
    }
    if (lobbyIsOpen(lobby)) {
      await prisma.lobby.update({
        where: { code },
        data: { closedAt: new Date() },
      });
    }

    const response = await loadLobbyResponse(code);
    if (!response) return jsonError(404, "Lobby not found");
    return Response.json(response);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
