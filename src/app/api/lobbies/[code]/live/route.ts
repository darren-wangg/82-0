/**
 * GET /api/lobbies/[code]/live — compact state for the live-lobby poll.
 *
 * Returns phase + participants progress + metadata. No full round-robin
 * computation during the draft — that only runs after results.
 */

import { prisma } from "@/lib/db";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { lobbyPhase } from "../../../_lib/lobbies";
import type { LiveLobbyState, LiveParticipant } from "@/lib/live-lobby";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/live">
) {
  const { code } = await ctx.params;

  try {
    const lobby = await prisma.lobby.findUnique({
      where: { code },
      select: {
        isLive: true,
        startedAt: true,
        closedAt: true,
        teamSize: true,
        participants: {
          orderBy: { joinedAt: "asc" },
          select: {
            displayName: true,
            picksCount: true,
            done: true,
          },
        },
      },
    });

    if (!lobby) return jsonError(404, "Lobby not found");

    const phase = lobbyPhase(lobby);
    const participants: LiveParticipant[] = lobby.participants.map((p) => ({
      displayName: p.displayName,
      picksCount: p.picksCount,
      total: lobby.teamSize,
      done: p.done,
    }));

    const state: LiveLobbyState = {
      phase,
      isLive: lobby.isLive,
      participants,
      startedAt: lobby.startedAt?.toISOString() ?? null,
      teamSize: lobby.teamSize,
    };

    return Response.json(state);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Couldn't load this lobby right now");
    }
    throw err;
  }
}
