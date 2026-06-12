/** Lobby loading + lifecycle shared by /api/lobbies/* and the /l/[code] page. */

import { LobbyResponse, Roster, RosterSchema } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { getEngine } from "@/lib/engine-provider";
import { computeStandings } from "@/components/social/standings";
import { ownerDisplayName, ratingFromRow, teamInclude } from "./teams";

/** Open means entries are still accepted: the creator hasn't ended it. */
export function lobbyIsOpen(lobby: { closedAt: Date | null }): boolean {
  return lobby.closedAt === null;
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
      // The name typed at entry wins; a claimed account name is the fallback.
      displayName: entry.displayName ?? ownerDisplayName(entry.team),
      rating: ratingFromRow(entry.team),
    })),
    getEngine()
  );
  const open = lobbyIsOpen(lobby);

  return {
    code: lobby.code,
    name: lobby.name,
    createdAt: lobby.createdAt.toISOString(),
    closedAt: lobby.closedAt?.toISOString() ?? null,
    status: open ? "open" : "closed",
    winner: !open && standings.length > 0 ? standings[0] : null,
    standings,
  };
}

/** teamSlug → roster for every entry (the summary card lists players). */
export async function loadLobbyRosters(code: string): Promise<Map<string, Roster>> {
  const entries = await prisma.lobbyEntry.findMany({
    where: { lobbyCode: code },
    include: { team: { select: { slug: true, roster: true } } },
  });
  const rosters = new Map<string, Roster>();
  for (const entry of entries) {
    const parsed = RosterSchema.safeParse(entry.team.roster);
    if (parsed.success) rosters.set(entry.team.slug, parsed.data);
  }
  return rosters;
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
