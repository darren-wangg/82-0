/** Lobby loading shared by GET /api/lobbies/[code] and the /l/[code] page. */

import { LobbyResponse } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getEngine } from "@/lib/engine-provider";
import { computeStandings } from "@/components/social/standings";
import { ownerDisplayName, ratingFromRow, teamInclude } from "./teams";

export async function loadLobbyResponse(code: string): Promise<LobbyResponse | null> {
  const lobby = await prisma.lobby.findUnique({
    where: { code },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
        include: { team: { include: teamInclude } },
      },
    },
  });
  if (!lobby) return null;

  const standings = computeStandings(
    lobby.entries.map((entry) => ({
      teamSlug: entry.team.slug,
      teamName: entry.team.teamName,
      displayName: ownerDisplayName(entry.team),
      rating: ratingFromRow(entry.team),
    })),
    getEngine()
  );

  return {
    code: lobby.code,
    name: lobby.name,
    createdAt: lobby.createdAt.toISOString(),
    standings,
  };
}
