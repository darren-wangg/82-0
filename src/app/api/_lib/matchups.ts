/** Matchup loading shared by GET-style consumers and the /m/[id] page. */

import { MatchupResponse, MatchupResult } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { teamInclude, toSavedTeam } from "./teams";

export async function loadMatchupResponse(id: string): Promise<MatchupResponse | null> {
  const matchup = await prisma.matchup.findUnique({
    where: { id },
    include: {
      teamA: { include: teamInclude },
      teamB: { include: teamInclude },
    },
  });
  if (!matchup) return null;

  return {
    id: matchup.id,
    teamA: toSavedTeam(matchup.teamA),
    teamB: toSavedTeam(matchup.teamB),
    result: matchup.result as unknown as MatchupResult,
  };
}
