/**
 * POST /api/lobbies/[code]/join — join a live lobby's waiting room.
 *
 * Creates a LobbyParticipant for the calling device (the live presence/progress
 * layer). Only allowed while the lobby is in the waiting phase (the creator
 * hasn't started). Idempotent per device (unique on lobbyCode+anonIdentityId) —
 * re-joining just refreshes the display name. Respects the team limit as a cap
 * on the number of drafters.
 */

import { JoinLobbyBodySchema, lobbyPhase } from "@/lib/live-lobby";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { containsProfanity, PROFANITY_ERROR } from "@/lib/profanity";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { loadLiveLobbyState } from "../../../_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/join">
) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyEnter);
  if (limited) return limited;

  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = JoinLobbyBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { displayName } = parsed.data;
  if (containsProfanity(displayName)) {
    return jsonError(422, PROFANITY_ERROR);
  }

  try {
    const anonId = await getOrCreateAnonId();
    const lobby = await prisma.lobby.findUnique({
      where: { code },
      select: { isLive: true, startedAt: true, closedAt: true, teamLimit: true },
    });
    if (!lobby) return jsonError(404, "Lobby not found");
    if (!lobby.isLive) return jsonError(409, "This isn't a live lobby");
    if (lobbyPhase(lobby) !== "waiting") {
      return jsonError(409, "The draft has already started");
    }

    const existing = await prisma.lobbyParticipant.findUnique({
      where: { lobbyCode_anonIdentityId: { lobbyCode: code, anonIdentityId: anonId } },
      select: { id: true },
    });
    if (existing) {
      // Already in — just refresh the display name.
      await prisma.lobbyParticipant.update({
        where: { id: existing.id },
        data: { displayName },
      });
    } else {
      if (lobby.teamLimit !== null) {
        const count = await prisma.lobbyParticipant.count({ where: { lobbyCode: code } });
        if (count >= lobby.teamLimit) return jsonError(409, "This lobby is full");
      }
      await prisma.lobbyParticipant.create({
        data: { lobbyCode: code, anonIdentityId: anonId, displayName },
      });
    }

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
