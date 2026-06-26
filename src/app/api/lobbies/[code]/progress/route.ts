/**
 * PATCH /api/lobbies/[code]/progress — update this device's pick count.
 *
 * Tiny write called (debounced) after each PLACE during a live draft.
 * Only updates the calling device's own LobbyParticipant row.
 */

import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { DraftProgressSchema } from "@/lib/live-lobby";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/progress">
) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyProgress);
  if (limited) return limited;

  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = DraftProgressSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { picksCount } = parsed.data;

  try {
    const anonId = await getAnonIdFromCookie();
    if (!anonId) return jsonError(401, "No device identity found");

    const updated = await prisma.lobbyParticipant.updateMany({
      where: { lobbyCode: code, anonIdentityId: anonId, done: false },
      data: { picksCount },
    });

    if (updated.count === 0) {
      // Not a participant or already done — silently succeed (idempotent).
    }

    return Response.json({ ok: true });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
