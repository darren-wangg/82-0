/** Lobby loading + lifecycle shared by /api/lobbies/* and the /l/[code] page. */

import { LobbyResponse, Roster } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getAnonIdFromCookie } from "@/lib/auth";
import { getEngine } from "@/lib/engine-provider";
import { computeStandings } from "@/components/social/standings";
import {
  FlexibleRosterSchema,
  ownerDisplayName,
  ratingFromRow,
  teamInclude,
} from "./teams";

/** Open means entries are still accepted: the creator hasn't ended it. */
export function lobbyIsOpen(lobby: { closedAt: Date | null }): boolean {
  return lobby.closedAt === null;
}

const ACTIVE_LOBBY_LIMIT = 50;

/** One row of the global "active lobbies" list. */
export interface ActiveLobbySummary {
  code: string;
  name: string;
  /** Teams entered so far. */
  entrantCount: number;
  /** Max teams allowed; null = unlimited. */
  teamLimit: number | null;
  /** Roster size: 5 (starters only), 8 (classic), or 10. */
  teamSize: number;
  createdAt: string;
}

/**
 * Lobbies discoverable on the global list: every lobby of the given team size
 * that's still open (the creator hasn't ended it), regardless of age. Closed
 * lobbies fall out of this query — their /l/[code] pages stay reachable, they
 * just leave the public board. Newest first, capped at ACTIVE_LOBBY_LIMIT.
 * (We'll revisit the age/volume policy if traffic ever warrants it.)
 */
export async function loadActiveLobbies(
  teamSize: number
): Promise<ActiveLobbySummary[]> {
  const lobbies = await prisma.lobby.findMany({
    where: { closedAt: null, teamSize },
    orderBy: { createdAt: "desc" },
    take: ACTIVE_LOBBY_LIMIT,
    select: {
      code: true,
      name: true,
      teamLimit: true,
      teamSize: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
  });

  return lobbies.map((lobby) => ({
    code: lobby.code,
    name: lobby.name,
    entrantCount: lobby._count.entries,
    teamLimit: lobby.teamLimit,
    teamSize: lobby.teamSize,
    createdAt: lobby.createdAt.toISOString(),
  }));
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
    const parsed = FlexibleRosterSchema.safeParse(entry.team.roster);
    if (parsed.success) rosters.set(entry.team.slug, parsed.data);
  }
  return rosters;
}

/** What the current device is to this lobby, plus the lobby's team limit
 *  (page-render only, reads the anon cookie without setting one). */
export async function loadLobbyViewer(code: string): Promise<{
  isCreator: boolean;
  entryTeamSlug: string | null;
  teamLimit: number | null;
  teamSize: number;
}> {
  const anonId = await getAnonIdFromCookie();
  const [lobby, entry] = await Promise.all([
    prisma.lobby.findUnique({
      where: { code },
      select: { creatorAnonId: true, teamLimit: true, teamSize: true },
    }),
    anonId
      ? prisma.lobbyEntry.findFirst({
          where: { lobbyCode: code, anonIdentityId: anonId },
          select: { teamSlug: true },
        })
      : null,
  ]);
  return {
    isCreator: anonId !== null && lobby?.creatorAnonId === anonId,
    entryTeamSlug: entry?.teamSlug ?? null,
    teamLimit: lobby?.teamLimit ?? null,
    teamSize: lobby?.teamSize ?? 8,
  };
}
