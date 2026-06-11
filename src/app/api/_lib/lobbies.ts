/** Lobby loading + lifecycle shared by /api/lobbies/* and the /l/[code] page. */

import { LOBBY_DURATION_HOURS, LobbyResponse } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { getEngine } from "@/lib/engine-provider";
import { computeStandings } from "@/components/social/standings";
import { ownerDisplayName, ratingFromRow, teamInclude } from "./teams";

export function lobbyClosesAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + LOBBY_DURATION_HOURS * 60 * 60 * 1000);
}

/** Open means entries are still accepted: not ended early, window not lapsed. */
export function lobbyIsOpen(lobby: { createdAt: Date; closedAt: Date | null }): boolean {
  return lobby.closedAt === null && Date.now() < lobbyClosesAt(lobby.createdAt).getTime();
}

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
  const open = lobbyIsOpen(lobby);

  return {
    code: lobby.code,
    name: lobby.name,
    createdAt: lobby.createdAt.toISOString(),
    closesAt: (lobby.closedAt ?? lobbyClosesAt(lobby.createdAt)).toISOString(),
    status: open ? "open" : "closed",
    winner: !open && standings.length > 0 ? standings[0] : null,
    standings,
  };
}

/** What the current device is to this lobby (page-render only, reads the
 *  anon cookie without setting one). */
export async function loadLobbyViewer(code: string): Promise<{
  isCreator: boolean;
  entryTeamSlug: string | null;
}> {
  const anonId = await getAnonIdFromCookie();
  if (!anonId) return { isCreator: false, entryTeamSlug: null };
  const [lobby, entry] = await Promise.all([
    prisma.lobby.findUnique({ where: { code }, select: { creatorAnonId: true } }),
    prisma.lobbyEntry.findFirst({
      where: { lobbyCode: code, anonIdentityId: anonId },
      select: { teamSlug: true },
    }),
  ]);
  return {
    isCreator: lobby?.creatorAnonId === anonId,
    entryTeamSlug: entry?.teamSlug ?? null,
  };
}
