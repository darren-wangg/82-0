/**
 * POST /api/lobbies/[code]/finish — submit a completed live-draft team.
 *
 * Wraps the existing enter logic:
 *  1. Verifies the team belongs to this device and was drafted after lobby open.
 *  2. Creates a LobbyEntry (exactly as /api/lobbies/enter does) so that
 *     computeStandings / reveal animations work unchanged.
 *  3. Marks this participant done and records teamSlug.
 *  4. When ALL participants are done, sets closedAt (→ results phase).
 *
 * Server recomputes the rating on finish — spin legality is not validated
 * (same trust model as the async enter route).
 */

import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { containsProfanity, PROFANITY_ERROR } from "@/lib/profanity";
import { FinishLobbySchema } from "@/lib/live-lobby";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { lobbyPhase } from "../../../_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/finish">
) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyFinish);
  if (limited) return limited;

  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = FinishLobbySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { teamSlug, displayName } = parsed.data;

  if (displayName && containsProfanity(displayName)) {
    return jsonError(422, PROFANITY_ERROR);
  }

  try {
    const anonIdentityId = await getOrCreateAnonId();

    const [lobby, team, participant] = await Promise.all([
      prisma.lobby.findUnique({
        where: { code },
        include: { _count: { select: { participants: true } } },
      }),
      prisma.team.findUnique({ where: { slug: teamSlug } }),
      prisma.lobbyParticipant.findFirst({
        where: { lobbyCode: code, anonIdentityId },
      }),
    ]);

    if (!lobby) return jsonError(404, "Lobby not found");
    if (!team) return jsonError(404, "Team not found");
    if (!lobby.isLive) return jsonError(400, "This is not a live lobby");

    const phase = lobbyPhase(lobby);
    if (phase === "results") return jsonError(409, "This lobby has already ended");
    if (phase === "waiting") return jsonError(409, "The draft has not started yet");

    // Verify team ownership (same rule as async enter).
    if (team.anonIdentityId !== anonIdentityId) {
      return jsonError(403, "You can only enter a team drafted on this device");
    }
    // Team must be drafted after the lobby opened.
    if (team.createdAt < lobby.createdAt) {
      return jsonError(
        422,
        "Lobby entries must be drafted fresh — start a draft from the lobby page"
      );
    }
    // Team size must match the lobby's roster size.
    if (team.teamSize !== lobby.teamSize) {
      return jsonError(
        422,
        `This is a ${lobby.teamSize}-man lobby — draft a ${lobby.teamSize}-man team.`
      );
    }

    // Create the LobbyEntry (the existing standings path; idempotent on
    // the unique constraint [lobbyCode, anonIdentityId]).
    try {
      await prisma.lobbyEntry.create({
        data: { lobbyCode: code, teamSlug, anonIdentityId, displayName },
      });
    } catch (err) {
      const isUniqueViolation =
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "P2002";
      if (!isUniqueViolation) throw err;
      // Already entered (idempotent) — update name if changed.
      const existing = await prisma.lobbyEntry.findFirst({
        where: { lobbyCode: code, anonIdentityId },
      });
      if (existing && displayName && existing.displayName !== displayName) {
        await prisma.lobbyEntry.update({
          where: { id: existing.id },
          data: { displayName },
        });
      }
    }

    // Carry the display name onto the team row (same as async enter).
    if (displayName) {
      await prisma.team.update({
        where: { slug: teamSlug },
        data: { ownerName: displayName },
      });
    }

    // Mark this participant done.
    if (participant) {
      await prisma.lobbyParticipant.update({
        where: { id: participant.id },
        data: { done: true, teamSlug, picksCount: team.teamSize },
      });
    }

    // Check whether all participants are now done → transition to results.
    const doneCount = await prisma.lobbyParticipant.count({
      where: { lobbyCode: code, done: true },
    });
    const totalCount = lobby._count.participants;

    if (doneCount >= totalCount && totalCount > 0) {
      await prisma.lobby.update({
        where: { code },
        data: { closedAt: new Date() },
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
