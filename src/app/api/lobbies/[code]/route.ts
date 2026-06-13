/**
 * GET /api/lobbies/[code] → LobbyResponse with round-robin standings.
 * PATCH /api/lobbies/[code] → creator changes the team limit (or clears it).
 */

import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../_lib/teams";
import { loadLobbyResponse } from "../../_lib/lobbies";
import { LOBBY_LIMIT_MAX, LOBBY_LIMIT_MIN, TeamLimitSchema } from "../route";

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

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]">
) {
  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = TeamLimitSchema.safeParse((body as { limit?: unknown }).limit);
  if (!parsed.success) {
    return jsonError(400, `Team limit must be ${LOBBY_LIMIT_MIN}–${LOBBY_LIMIT_MAX}`);
  }
  const teamLimit = parsed.data ?? null;

  try {
    const lobby = await prisma.lobby.findUnique({
      where: { code },
      select: { creatorAnonId: true, closedAt: true, _count: { select: { entries: true } } },
    });
    if (!lobby) return jsonError(404, "Lobby not found");

    const anonId = await getAnonIdFromCookie();
    if (!lobby.creatorAnonId || lobby.creatorAnonId !== anonId) {
      return jsonError(403, "Only the lobby creator can change the limit");
    }
    if (lobby.closedAt) {
      return jsonError(409, "This lobby is closed");
    }
    // Can't cap below the teams already in — they don't get kicked.
    if (teamLimit !== null && teamLimit < lobby._count.entries) {
      return jsonError(
        422,
        `${lobby._count.entries} teams have already joined — set the limit that high or higher`
      );
    }

    await prisma.lobby.update({ where: { code }, data: { teamLimit } });
    return Response.json({ teamLimit });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
