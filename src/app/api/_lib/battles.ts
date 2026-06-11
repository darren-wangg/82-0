/** Recent head-to-head battles for one team, oriented from its perspective. */

import { MatchupResult } from "@/lib/contracts";
import { prisma } from "@/lib/db";

export const BATTLE_HISTORY_SIZE = 10;

export interface BattleRow {
  matchupId: string;
  opponentSlug: string;
  opponentName: string;
  /** True when this team won the series. */
  won: boolean;
  /** Series score oriented [this team, opponent]. */
  series: [number, number];
  createdAt: string;
}

export interface BattleHistory {
  rows: BattleRow[];
  /** Series won / lost across the rows shown. */
  record: { wins: number; losses: number };
}

export async function loadBattleHistory(slug: string): Promise<BattleHistory> {
  const matchups = await prisma.matchup.findMany({
    where: { OR: [{ teamASlug: slug }, { teamBSlug: slug }] },
    orderBy: { createdAt: "desc" },
    take: BATTLE_HISTORY_SIZE,
    include: {
      teamA: { select: { slug: true, teamName: true } },
      teamB: { select: { slug: true, teamName: true } },
    },
  });

  const rows = matchups.map((m): BattleRow => {
    const result = m.result as unknown as MatchupResult;
    const isA = m.teamASlug === slug;
    const opponent = isA ? m.teamB : m.teamA;
    const [aWins, bWins] = result.seriesScore;
    return {
      matchupId: m.id,
      opponentSlug: opponent.slug,
      opponentName: opponent.teamName,
      won: isA ? result.winner === "A" : result.winner === "B",
      series: isA ? [aWins, bWins] : [bWins, aWins],
      createdAt: m.createdAt.toISOString(),
    };
  });

  return {
    rows,
    record: {
      wins: rows.filter((r) => r.won).length,
      losses: rows.filter((r) => !r.won).length,
    },
  };
}
