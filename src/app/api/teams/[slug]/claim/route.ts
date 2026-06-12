/**
 * POST /api/teams/[slug]/claim — the owning device puts a name on its team.
 *
 * Leaderboard entries are generic until a GM name exists (set here or when
 * the team entered a lobby with one). Ownership = the anon device cookie
 * that saved the team; no accounts involved. The team name may be updated
 * in the same call.
 */

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { isDbUnavailable, jsonError } from "../../../_lib/teams";
import { RATE_LIMITS, rateLimitGate } from "../../../_lib/rate-limit";

const ClaimRequestSchema = z.object({
  // Same bounds as a lobby entrant's name / a saved team's name.
  displayName: z.string().trim().min(1).max(24),
  teamName: z.string().trim().min(1).max(40).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = await rateLimitGate(request, RATE_LIMITS.teamClaim);
  if (limited) return limited;

  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }
  const parsed = ClaimRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { displayName, teamName } = parsed.data;

  try {
    const anonIdentityId = await getOrCreateAnonId();
    const team = await prisma.team.findUnique({ where: { slug } });
    if (!team) return jsonError(404, "Team not found");
    if (team.anonIdentityId !== anonIdentityId) {
      return jsonError(403, "You can only claim a team saved on this device");
    }

    await prisma.team.update({
      where: { slug },
      data: { ownerName: displayName, ...(teamName ? { teamName } : {}) },
    });

    // Show the name immediately instead of waiting out the 60s caches —
    // expire: 0 forces a blocking refetch on the next view (claims are rare;
    // "max" would serve the stale, nameless row once more).
    revalidateTag("leaderboard-rows", { expire: 0 });
    revalidatePath(`/t/${slug}`);

    return Response.json({ ok: true });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Claiming is temporarily unavailable");
    }
    throw err;
  }
}
