/**
 * /m/[id] — matchup result page: series score, per-category edge bars, and a
 * streaming AI recap of why the winner won.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POSITIONS, type PlayerStatLine, type Roster } from "@/lib/contracts";
import { MatchupResponse } from "@/lib/contracts";
import { loadMatchupResponse } from "@/app/api/_lib/matchups";
import { getPlayerMap, getSnapshot } from "@/lib/snapshot";
import { FAMOUS_TEAM_BY_SLUG, famousTeamFranchise } from "@/lib/famous-teams";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EdgeBars } from "@/components/social/edge-bars";
import { ExplainStream } from "@/components/social/explain-stream";
import { MatchupScoreboard } from "@/components/social/matchup-scoreboard";
import { MatchupRosters } from "@/components/social/matchup-rosters";
import { ShareButton } from "@/components/social/share-button";
import { Unavailable } from "@/components/social/unavailable";

/** Franchise tricode for a side, only when it's a famous preset team (so the
 *  budget opponent shows a logo; a user's mixed-franchise team shows none). */
function franchiseForSlug(slug: string): string | null {
  const ft = FAMOUS_TEAM_BY_SLUG.get(slug);
  return ft ? famousTeamFranchise(ft) : null;
}

/** Rendered per request: the cookie-driven locale (read in the root layout)
 *  forces dynamic rendering, so this can't be ISR-cached (same as /t/[slug]).
 *  See docs/scaling.md for the i18n caching tradeoff. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/m/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const m = await loadMatchupResponse(id);
    if (!m) return { title: "Matchup not found" };
    return {
      title: `${m.teamA.teamName} vs ${m.teamB.teamName}`,
      description: `Best-of-7 simulation: ${m.result.seriesScore[0]}–${m.result.seriesScore[1]}.`,
    };
  } catch {
    return { title: "Matchup" };
  }
}

/** Resolve a stored roster (ids) to players in starter-then-bench order. */
function resolveRoster(
  roster: Roster,
  playerMap: Map<string, PlayerStatLine>
): PlayerStatLine[] {
  const ids = [...POSITIONS.map((p) => roster.starters[p]), ...roster.bench];
  return ids.flatMap((id) => playerMap.get(id) ?? []);
}

export default async function MatchupPage({ params }: PageProps<"/m/[id]">) {
  const { id } = await params;

  let matchup: MatchupResponse | null;
  try {
    matchup = await loadMatchupResponse(id);
  } catch {
    return <Unavailable what="this matchup" />;
  }
  if (!matchup) notFound();

  const { teamA, teamB, result } = matchup;
  const [aWins, bWins] = result.seriesScore;

  const playerMap = getPlayerMap(getSnapshot());
  const teamAPlayers = resolveRoster(teamA.roster, playerMap);
  const teamBPlayers = resolveRoster(teamB.roster, playerMap);

  return (
    <main className="space-y-5">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Best-of-7 simulation
        </p>
        <h1 className="sr-only">
          {teamA.teamName} vs {teamB.teamName}
        </h1>
      </div>

      <MatchupScoreboard
        teamAName={teamA.teamName}
        teamASlug={teamA.slug}
        teamAOvr={teamA.rating.ovr}
        teamAFranchise={franchiseForSlug(teamA.slug)}
        teamBName={teamB.teamName}
        teamBSlug={teamB.slug}
        teamBOvr={teamB.rating.ovr}
        teamBFranchise={franchiseForSlug(teamB.slug)}
        aWins={aWins}
        bWins={bWins}
        pGameA={result.pGameA}
        winner={result.winner}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rosters</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchupRosters
            teamAName={teamA.teamName}
            teamAPlayers={teamAPlayers}
            teamBName={teamB.teamName}
            teamBPlayers={teamBPlayers}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Category edges</CardTitle>
        </CardHeader>
        <CardContent>
          <EdgeBars
            breakdown={result.catBreakdown}
            teamAName={teamA.teamName}
            teamBName={teamB.teamName}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Series recap</CardTitle>
        </CardHeader>
        <CardContent>
          <ExplainStream request={{ kind: "matchup", matchupId: matchup.id }} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Link href="/play" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Build your own team
        </Link>
        <ShareButton
          title={`${teamA.teamName} vs ${teamB.teamName} — Ultimate Draft`}
          path={`/m/${matchup.id}`}
          label="Share this result"
          className="w-full"
        />
      </div>
    </main>
  );
}
