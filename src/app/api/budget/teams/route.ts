/**
 * POST /api/budget/teams — save a budget-mode drafted team.
 *
 * Extends the standard team save with:
 *   1. Budget validation: recomputes Σprices server-side and rejects (422)
 *      any roster whose total exceeds the claimed difficulty cap.
 *   2. Saves mode="budget" and difficulty on the Team row.
 *
 * All other behaviour (engine recompute, slug minting, anon ownership) is
 * identical to POST /api/teams; this route delegates to the same shared lib.
 */

import { z } from "zod";
import { SaveTeamResponse } from "@/lib/contracts";
import { containsProfanity, PROFANITY_ERROR } from "@/lib/profanity";
import { getSnapshot } from "@/lib/snapshot";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { makeTeamSlug } from "@/components/social/hashing";
import { budgetCap, BUDGET_DIFFICULTIES, type BudgetDifficulty } from "@/lib/budget";
import { priceMapOf } from "@/lib/pricing";
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
} from "../../_lib/teams";
import { RATE_LIMITS, rateLimitGate } from "../../_lib/rate-limit";

const SLUG_ATTEMPTS = 5;

/** Budget teams can be saved unnamed (a name is only needed to show named on
 *  the leaderboard); blank/omitted falls back to a generic name below. */
const DEFAULT_BUDGET_TEAM_NAME = "Budget Lineup";

const BudgetSaveTeamBodySchema = z.object({
  teamName: z.string().trim().max(40).optional(),
  roster: FlexibleRosterSchema,
  snapshotVersion: z.string(),
  difficulty: z.enum(BUDGET_DIFFICULTIES),
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

  const parsed = BudgetSaveTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { teamName, roster, snapshotVersion, difficulty } = parsed.data;
  // Name is optional for budget: only matters for a named leaderboard entry.
  const finalName = teamName && teamName.length > 0 ? teamName : DEFAULT_BUDGET_TEAM_NAME;

  if (teamName && containsProfanity(teamName)) {
    return jsonError(422, PROFANITY_ERROR);
  }

  const snapshot = getSnapshot();
  if (snapshotVersion !== snapshot.version) {
    return jsonError(
      409,
      `Snapshot version mismatch (got ${snapshotVersion}, server is on ${snapshot.version}); please refresh and redraft`
    );
  }

  // Server-authoritative budget validation: recompute Σprices, reject if over cap.
  const prices = priceMapOf(snapshot);
  const allIds = [...Object.values(roster.starters), ...roster.bench];
  let totalSpend = 0;
  for (const id of allIds) {
    const price = prices.get(id);
    if (price === undefined) {
      return jsonError(422, `Unknown player id: ${id}`);
    }
    totalSpend += price;
  }
  // Cap scales with roster size; the size is taken from the roster itself
  // (5 starters + bench), so it can't be spoofed independently of the team.
  const size = teamSizeOf(roster);
  if (size !== 5 && size !== 8 && size !== 10) {
    return jsonError(422, `Budget rosters are 5, 8, or 10 players (got ${size})`);
  }
  const cap = budgetCap(size, difficulty as BudgetDifficulty);
  if (totalSpend > cap) {
    return jsonError(
      422,
      `Budget exceeded: roster costs $${totalSpend} but the ${difficulty} cap is $${cap}`
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

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
      const slug = makeTeamSlug();
      try {
        const team = await prisma.team.create({
          data: {
            slug,
            teamName: finalName,
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
            mode: "budget",
            difficulty,
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
          err instanceof Error &&
          "code" in err &&
          (err as { code?: string }).code === "P2002";
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
