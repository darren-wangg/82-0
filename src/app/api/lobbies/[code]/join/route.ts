/**
 * POST /api/lobbies/[code]/join — join a live lobby as a participant.
 *
 * Creates a LobbyParticipant for this device in the waiting phase.
 * Idempotent per device (re-joining updates the displayName if changed).
 * Respects the lobby's teamLimit.
 */

import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { containsProfanity, PROFANITY_ERROR } from "@/lib/profanity";
import { JoinLobbySchema } from "@/lib/live-lobby";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { lobbyPhase } from "../../../_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/join">
) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyJoin);
  if (limited) return limited;

  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = JoinLobbySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { displayName } = parsed.data;

  if (containsProfanity(displayName)) {
    return jsonError(422, PROFANITY_ERROR);
  }

  try {
    const anonIdentityId = await getOrCreateAnonId();

    const lobby = await prisma.lobby.findUnique({
      where: { code },
      select: {
        isLive: true,
        startedAt: true,
        closedAt: true,
        teamLimit: true,
        _count: { select: { participants: true } },
      },
    });
    if (!lobby) return jsonError(404, "Lobby not found");
    if (!lobby.isLive) return jsonError(400, "This is not a live lobby");

    const phase = lobbyPhase(lobby);
    if (phase !== "waiting") {
      return jsonError(409, phase === "drafting" ? "The draft has already started" : "This lobby has ended");
    }

    // Check existing participant (idempotent join)
    const existing = await prisma.lobbyParticipant.findFirst({
      where: { lobbyCode: code, anonIdentityId },
    });

    if (!existing) {
      // Enforce team cap on new joiners only.
      if (lobby.teamLimit !== null && lobby._count.participants >= lobby.teamLimit) {
        return jsonError(409, "This lobby is full");
      }
      await prisma.lobbyParticipant.create({
        data: { lobbyCode: code, anonIdentityId, displayName },
      });
    } else if (existing.displayName !== displayName) {
      // Re-joining: refresh the display name.
      await prisma.lobbyParticipant.update({
        where: { id: existing.id },
        data: { displayName },
      });
    }

    return Response.json({ ok: true }, { status: existing ? 200 : 201 });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
