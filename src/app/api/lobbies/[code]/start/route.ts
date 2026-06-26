/**
 * POST /api/lobbies/[code]/start — creator kicks off the live draft.
 *
 * Sets startedAt on the Lobby, transitioning from waiting → drafting.
 * Requires ≥2 participants. Creator-only (mirrors close/route.ts auth).
 */

import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { lobbyPhase } from "../../../_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

const MIN_PARTICIPANTS = 2;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/start">
) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyStart);
  if (limited) return limited;

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
    if (!lobby.isLive) return jsonError(400, "This is not a live lobby");

    const anonId = await getAnonIdFromCookie();
    if (!lobby.creatorAnonId || lobby.creatorAnonId !== anonId) {
      return jsonError(403, "Only the lobby creator can start the draft");
    }

    const phase = lobbyPhase(lobby);
    if (phase === "results") return jsonError(409, "This lobby has already ended");
    if (phase === "drafting") {
      // Already started — idempotent.
      return Response.json({ ok: true });
    }

    if (lobby._count.participants < MIN_PARTICIPANTS) {
      return jsonError(
        422,
        `Need at least ${MIN_PARTICIPANTS} players to start — invite more friends first`
      );
    }

    await prisma.lobby.update({
      where: { code },
      data: { startedAt: new Date() },
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
