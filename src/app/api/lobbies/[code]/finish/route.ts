/**
 * POST /api/lobbies/[code]/finish — submit a finished team in a live draft.
 *
 * The team was already saved by this device (via the normal /api/teams path);
 * finish records it into the lobby exactly like the async /api/lobbies/enter
 * path (creating the LobbyEntry that standings/results read), then marks the
 * caller's participant done. When the LAST participant finishes, the lobby is
 * closed → results, so the existing round-robin + reveal run unchanged.
 *
 * Server-authoritative checks mirror enter: the team must belong to this device,
 * be drafted after the lobby opened, and match the lobby's roster size.
 */

import { FinishLobbyBodySchema, lobbyPhase } from "@/lib/live-lobby";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { containsProfanity, PROFANITY_ERROR } from "@/lib/profanity";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { loadLiveLobbyState } from "../../../_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/finish">
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

  const parsed = FinishLobbyBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { teamSlug, displayName } = parsed.data;
  if (displayName && containsProfanity(displayName)) {
    return jsonError(422, PROFANITY_ERROR);
  }

  try {
    const anonId = await getOrCreateAnonId();
    const [lobby, team, participant] = await Promise.all([
      prisma.lobby.findUnique({ where: { code } }),
      prisma.team.findUnique({ where: { slug: teamSlug } }),
      prisma.lobbyParticipant.findUnique({
        where: { lobbyCode_anonIdentityId: { lobbyCode: code, anonIdentityId: anonId } },
      }),
    ]);
    if (!lobby) return jsonError(404, "Lobby not found");
    if (!lobby.isLive) return jsonError(409, "This isn't a live lobby");
    if (!participant) return jsonError(403, "Join the lobby before finishing");
    if (lobbyPhase(lobby) !== "drafting") {
      return jsonError(409, "The draft isn't running");
    }
    if (!team) return jsonError(404, "Team not found");
    if (team.anonIdentityId !== anonId) {
      return jsonError(403, "You can only submit a team drafted on this device");
    }
    if (team.createdAt < lobby.createdAt) {
      return jsonError(422, "Draft a fresh team from the lobby — old saves can't be submitted");
    }
    if (team.teamSize !== lobby.teamSize) {
      return jsonError(422, `This is a ${lobby.teamSize}-man lobby — draft a ${lobby.teamSize}-man team.`);
    }

    // Record the entry (idempotent: re-finishing the same team is a no-op; a
    // different team from this device is rejected). Mirrors /api/lobbies/enter.
    try {
      await prisma.lobbyEntry.create({
        data: { lobbyCode: code, teamSlug, anonIdentityId: anonId, displayName },
      });
    } catch (err) {
      const isUniqueViolation =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueViolation) throw err;
      const existing = await prisma.lobbyEntry.findFirst({
        where: { lobbyCode: code, anonIdentityId: anonId },
      });
      if (existing && existing.teamSlug !== teamSlug) {
        return jsonError(409, "This device already submitted a team in this lobby");
      }
    }

    if (displayName) {
      await prisma.team.update({ where: { slug: teamSlug }, data: { ownerName: displayName } });
    }

    // Mark this participant done.
    await prisma.lobbyParticipant.update({
      where: { id: participant.id },
      data: { done: true, teamSlug, picksCount: lobby.teamSize, displayName },
    });

    // Last one out closes the lobby → results. Guard on closedAt:null so only
    // the final finisher triggers the round-robin crowning.
    const remaining = await prisma.lobbyParticipant.count({
      where: { lobbyCode: code, done: false },
    });
    if (remaining === 0) {
      await prisma.lobby.updateMany({
        where: { code, closedAt: null },
        data: { closedAt: new Date() },
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
