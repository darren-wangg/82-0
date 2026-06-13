/**
 * POST /api/teams — save a drafted team.
 * Validates the roster, re-runs the engine server-side (client-computed
 * numbers are never persisted), mints a short unique slug, and stores the
 * team with anon (and, if signed in, user) ownership.
 */

import { z } from "zod";
import { SaveTeamResponse } from "@/lib/contracts";
import { getSnapshot } from "@/lib/snapshot";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { makeTeamSlug } from "@/components/social/hashing";
import {
  computeTeamOutputs,
  FlexibleRosterSchema,
  isDbUnavailable,
  jsonError,
  RosterError,
  teamInclude,
  teamSizeOf,
  toJsonInput,
  toSavedTeam,
} from "../_lib/teams";
import { RATE_LIMITS, rateLimitGate } from "../_lib/rate-limit";

const SLUG_ATTEMPTS = 5;

/** Save-team body. Mirrors the frozen SaveTeamRequestSchema but accepts the
 *  10-player beta's deeper bench (3–5) via the flexible roster parser. */
const SaveTeamBodySchema = z.object({
  teamName: z.string().min(1).max(40),
  roster: FlexibleRosterSchema,
  snapshotVersion: z.string(),
});

export async function POST(request: Request) {
  const limited = await rateLimitGate(request, RATE_LIMITS.teamSave);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = SaveTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { teamName, roster, snapshotVersion } = parsed.data;

  const snapshot = getSnapshot();
  if (snapshotVersion !== snapshot.version) {
    return jsonError(
      409,
      `Snapshot version mismatch (got ${snapshotVersion}, server is on ${snapshot.version}); please refresh and redraft`
    );
  }

  let outputs;
  try {
    outputs = computeTeamOutputs(roster);
  } catch (err) {
    if (err instanceof RosterError) return jsonError(422, err.message);
    throw err;
  }
  const { rating, season } = outputs;

  try {
    const anonIdentityId = await getOrCreateAnonId();

    // Retry on the (unlikely) slug collision.
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
      const slug = makeTeamSlug();
      try {
        const team = await prisma.team.create({
          data: {
            slug,
            teamName,
            roster: toJsonInput(roster),
            snapshotVersion,
            teamSize: teamSizeOf(roster),
            ovr: rating.ovr,
            offRating: rating.offRating,
            defRating: rating.defRating,
            catProfile: toJsonInput(rating.catProfile),
            wins: season.wins,
            losses: season.losses,
            gatedCategory: season.gatedCategory,
            anonIdentityId,
          },
          include: teamInclude,
        });

        const response: SaveTeamResponse = {
          team: toSavedTeam(team),
          url: `/t/${slug}`,
        };
        return Response.json(response, { status: 201 });
      } catch (err) {
        const isUniqueViolation =
          err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
        if (!isUniqueViolation || attempt === SLUG_ATTEMPTS - 1) throw err;
      }
    }
    return jsonError(500, "Could not allocate a team slug");
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Saving teams is temporarily unavailable");
    }
    throw err;
  }
}
