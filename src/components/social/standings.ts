/**
 * Lobby standings: a full round-robin of head-to-head simulations among the
 * lobby entries. Pure — the engine and seed function are injected, so this is
 * unit-testable with a stub engine and deterministic in production (the seed
 * for each pairing is a stable hash of the two slugs).
 */

import { Engine, LobbyStanding, TeamRating } from "@/lib/contracts";
import { stableSeed } from "./hashing";

export interface LobbyTeamInput {
  teamSlug: string;
  teamName: string;
  displayName: string | null;
  rating: TeamRating;
}

export function computeStandings(
  teams: LobbyTeamInput[],
  engine: Pick<Engine, "simulateMatchup">,
  seedFn: (slugA: string, slugB: string) => number = stableSeed
): LobbyStanding[] {
  const records = new Map<string, { wins: number; losses: number }>(
    teams.map((t) => [t.teamSlug, { wins: 0, losses: 0 }])
  );

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      const result = engine.simulateMatchup(
        a.rating,
        b.rating,
        seedFn(a.teamSlug, b.teamSlug)
      );
      const winner = result.winner === "A" ? a : b;
      const loser = result.winner === "A" ? b : a;
      records.get(winner.teamSlug)!.wins++;
      records.get(loser.teamSlug)!.losses++;
    }
  }

  return teams
    .map((t) => ({
      teamSlug: t.teamSlug,
      teamName: t.teamName,
      displayName: t.displayName,
      wins: records.get(t.teamSlug)!.wins,
      losses: records.get(t.teamSlug)!.losses,
      ovr: t.rating.ovr,
    }))
    .sort((x, y) => y.wins - x.wins || y.ovr - x.ovr);
}
