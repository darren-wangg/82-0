/**
 * POST /api/matchups — simulate (or replay) a head-to-head challenge.
 * Ratings are recomputed server-side from each team's stored roster; the seed
 * is a stable hash of the ordered slug pair so a pairing always replays
 * identically. Results are upserted on the unique (teamA, teamB, seed).
 */

import {
  CreateMatchupRequestSchema,
  MatchupResponse,
  MatchupResult,
  RosterSchema,
} from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getEngine } from "@/lib/engine-provider";
import { stableSeed } from "@/components/social/hashing";
import {
  computeTeamOutputs,
  isDbUnavailable,
  jsonError,
  findTeamBySlug,
  ratingFromRow,
  RosterError,
  toJsonInput,
  toSavedTeam,
  TeamWithOwner,
} from "../_lib/teams";

function ratingFor(team: TeamWithOwner) {
  // Prefer a fresh engine run from the roster (server authoritative); fall
  // back to the stored rating if the roster predates the current snapshot.
  try {
    const roster = RosterSchema.parse(team.roster);
    return computeTeamOutputs(roster).rating;
  } catch (err) {
    if (err instanceof RosterError) return ratingFromRow(team);
    throw err;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = CreateMatchupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { teamSlugA, teamSlugB } = parsed.data;
  if (teamSlugA === teamSlugB) {
    return jsonError(422, "A team can't challenge itself");
  }

  try {
    const [teamA, teamB] = await Promise.all([
      findTeamBySlug(teamSlugA),
      findTeamBySlug(teamSlugB),
    ]);
    if (!teamA) return jsonError(404, `Team not found: ${teamSlugA}`);
    if (!teamB) return jsonError(404, `Team not found: ${teamSlugB}`);

    const seed = stableSeed(teamSlugA, teamSlugB);
    const result = getEngine().simulateMatchup(
      ratingFor(teamA),
      ratingFor(teamB),
      seed
    );

    const matchup = await prisma.matchup.upsert({
      where: {
        teamASlug_teamBSlug_seed: {
          teamASlug: teamSlugA,
          teamBSlug: teamSlugB,
          seed,
        },
      },
      create: {
        teamASlug: teamSlugA,
        teamBSlug: teamSlugB,
        seed,
        result: toJsonInput(result),
      },
      update: { result: toJsonInput(result) },
    });

    const response: MatchupResponse = {
      id: matchup.id,
      teamA: toSavedTeam(teamA),
      teamB: toSavedTeam(teamB),
      result: matchup.result as unknown as MatchupResult,
    };
    return Response.json(response, { status: 201 });
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Matchups are temporarily unavailable");
    }
    throw err;
  }
}
