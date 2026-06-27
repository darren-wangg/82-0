/**
 * PATCH /api/lobbies/[code]/progress — update this device's live draft progress.
 *
 * A tiny write fired (debounced) after each pick during the draft so opponents
 * see the bar fill in near-real-time. Monotonic: the guard only advances the
 * count (a stale, lower value can't clobber a higher one) and never touches a
 * participant already marked done. Returns 204 — the client renders its own bar
 * optimistically and reads opponents from the poll.
 */

import { DraftProgressBodySchema } from "@/lib/live-lobby";
import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/lobbies/[code]/progress">
) {
  const { code } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = DraftProgressBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { picksCount } = parsed.data;

  try {
    const anonId = await getAnonIdFromCookie();
    if (!anonId) return jsonError(403, "Join the lobby first");

    await prisma.lobbyParticipant.updateMany({
      where: {
        lobbyCode: code,
        anonIdentityId: anonId,
        done: false,
        picksCount: { lt: picksCount },
      },
      data: { picksCount },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}
