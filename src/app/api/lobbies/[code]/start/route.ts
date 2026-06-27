/**
 * POST /api/lobbies/[code]/start — the creator starts the live draft.
 *
 * Creator-only (mirrors the auth pattern in [code]/close). Allowed only from the
 * waiting phase and only with ≥2 participants. Sets startedAt → the lobby moves
 * to the drafting phase and everyone's draft gate opens. updateMany with a
 * startedAt:null guard makes a double-tap idempotent.
 */

import { lobbyPhase } from "@/lib/live-lobby";
import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { loadLiveLobbyState } from "../../../_lib/lobbies";

const MIN_PARTICIPANTS = 2;

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/start">
) {
  const { code } = await ctx.params;
  try {
    const lobby = await prisma.lobby.findUnique({
      where: { code },
      select: {
        creatorAnonId: true,
        isLive: true,
        startedAt: true,
        closedAt: true,
        _count: { select: { participants: true } },
      },
    });
    if (!lobby) return jsonError(404, "Lobby not found");

    const anonId = await getAnonIdFromCookie();
    if (!lobby.creatorAnonId || lobby.creatorAnonId !== anonId) {
      return jsonError(403, "Only the lobby creator can start the draft");
    }
    if (!lobby.isLive) return jsonError(409, "This isn't a live lobby");
    if (lobbyPhase(lobby) !== "waiting") {
      return jsonError(409, "The draft has already started");
    }
    if (lobby._count.participants < MIN_PARTICIPANTS) {
      return jsonError(422, "Need at least 2 players to start");
    }

    await prisma.lobby.updateMany({
      where: { code, startedAt: null, closedAt: null },
      data: { startedAt: new Date() },
    });

    const state = await loadLiveLobbyState(code, anonId);
    if (!state) return jsonError(404, "Lobby not found");
    return Response.json(state);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
