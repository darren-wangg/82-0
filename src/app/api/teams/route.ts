/**
 * POST /api/teams — save a drafted team.
 * Validates the roster, re-runs the engine server-side (client-computed
 * numbers are never persisted), mints a short unique slug, and stores the
 * team with anon (and, if signed in, user) ownership.
 */

import {
  SaveTeamRequestSchema,
  SaveTeamResponse,
} from "@/lib/contracts";
import { getSnapshot } from "@/lib/snapshot";
import { prisma } from "@/lib/db";
import { auth, getOrCreateAnonId } from "@/lib/auth";
import { makeTeamSlug } from "@/components/social/hashing";
import {
  computeTeamOutputs,
  isDbUnavailable,
  jsonError,
  RosterError,
  teamInclude,
  toJsonInput,
  toSavedTeam,
} from "../_lib/teams";

const SLUG_ATTEMPTS = 5;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = SaveTeamRequestSchema.safeParse(body);
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
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;
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
            ovr: rating.ovr,
            offRating: rating.offRating,
            defRating: rating.defRating,
            catProfile: toJsonInput(rating.catProfile),
            wins: season.wins,
            losses: season.losses,
            gatedCategory: season.gatedCategory,
            anonIdentityId,
            userId,
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
