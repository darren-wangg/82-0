/**
 * POST /api/lobbies/enter — enter a lobby with a team drafted for it.
 *
 * Server-enforced rules:
 *  - the lobby must still be open (the creator hasn't ended it),
 *  - the team must belong to the calling device (no entering someone else's
 *    team) and have been created after the lobby opened (no loading old
 *    saved teams — every entrant drafts fresh),
 *  - one entry per device per lobby (DB unique constraint).
 */

import { EnterLobbyRequestSchema } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { containsProfanity, PROFANITY_ERROR } from "@/lib/profanity";
import { isDbUnavailable, jsonError } from "../../_lib/teams";
import { loadLobbyResponse, lobbyIsOpen } from "../../_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "../../_lib/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyEnter);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = EnterLobbyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { code, teamSlug, displayName } = parsed.data;

  if (displayName && containsProfanity(displayName)) {
    return jsonError(422, PROFANITY_ERROR);
  }

  try {
    const anonIdentityId = await getOrCreateAnonId();
    const [lobby, team] = await Promise.all([
      prisma.lobby.findUnique({ where: { code } }),
      prisma.team.findUnique({ where: { slug: teamSlug } }),
    ]);
    if (!lobby) return jsonError(404, "Lobby not found");
    if (!team) return jsonError(404, "Team not found");
    if (!lobbyIsOpen(lobby)) {
      return jsonError(409, "This lobby is closed — no new entries");
    }
    if (team.anonIdentityId !== anonIdentityId) {
      return jsonError(403, "You can only enter a team drafted on this device");
    }
    if (team.createdAt < lobby.createdAt) {
      return jsonError(
        422,
        "Lobby entries must be drafted fresh — start a draft from the lobby page"
      );
    }
    if (team.teamSize !== lobby.teamSize) {
      return jsonError(
        422,
        `This is a ${lobby.teamSize}-man lobby — draft a ${lobby.teamSize}-man team.`
      );
    }

    // Team cap: only blocks NEW entrants — a device already in the lobby can
    // still re-submit (idempotent / name refresh below).
    if (lobby.teamLimit !== null) {
      const existing = await prisma.lobbyEntry.findFirst({
        where: { lobbyCode: code, anonIdentityId },
        select: { id: true },
      });
      if (!existing) {
        const entered = await prisma.lobbyEntry.count({ where: { lobbyCode: code } });
        if (entered >= lobby.teamLimit) {
          return jsonError(409, "This lobby is full");
        }
      }
    }

    try {
      await prisma.lobbyEntry.create({
        data: { lobbyCode: code, teamSlug, anonIdentityId, displayName },
      });
    } catch (err) {
      const isUniqueViolation =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueViolation) throw err;
      // Same team twice is idempotent; a different team from this device is not.
      const existing = await prisma.lobbyEntry.findFirst({
        where: { lobbyCode: code, anonIdentityId },
      });
      if (existing && existing.teamSlug !== teamSlug) {
        return jsonError(409, "This device already entered a team in this lobby");
      }
      // Re-entering the same team is idempotent — but let it refresh the name.
      if (existing && displayName && existing.displayName !== displayName) {
        await prisma.lobbyEntry.update({
          where: { id: existing.id },
          data: { displayName },
        });
      }
    }

    // Carry the entrant's name onto the team itself so its leaderboard /
    // team-page entries are named, not generic.
    if (displayName) {
      await prisma.team.update({
        where: { slug: teamSlug },
        data: { ownerName: displayName },
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
