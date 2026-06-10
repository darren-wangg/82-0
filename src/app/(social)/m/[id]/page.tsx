/**
 * /m/[id] — matchup result page: series score, per-category edge bars, and a
 * streaming AI recap of why the winner won.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchupResponse } from "@/lib/contracts";
import { loadMatchupResponse } from "@/app/api/_lib/matchups";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EdgeBars } from "@/components/social/edge-bars";
import { ExplainStream } from "@/components/social/explain-stream";
import { ShareButton } from "@/components/social/share-button";
import { Unavailable } from "@/components/social/unavailable";

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

function TeamSide({
  name,
  slug,
  ovr,
  won,
  align,
}: {
  name: string;
  slug: string;
  ovr: number;
  won: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col",
        align === "right" ? "items-end text-right" : "items-start text-left"
      )}
    >
      {won && (
        <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
          Winner
        </span>
      )}
      <Link
        href={`/t/${slug}`}
        className="w-full truncate text-sm font-bold hover:underline"
      >
        {name}
      </Link>
      <span className="text-xs text-muted-foreground">OVR {Math.round(ovr)}</span>
    </div>
  );
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

      <div className="flex items-center gap-3">
        <TeamSide
          name={teamA.teamName}
          slug={teamA.slug}
          ovr={teamA.rating.ovr}
          won={result.winner === "A"}
          align="left"
        />
        <div className="shrink-0 text-center">
          <p className="text-5xl font-black tracking-tight tabular-nums">
            {aWins}
            <span className="text-muted-foreground">–</span>
            {bWins}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {(result.pGameA * 100).toFixed(0)}% per-game edge to{" "}
            {result.pGameA >= 0.5 ? teamA.teamName : teamB.teamName}
          </p>
        </div>
        <TeamSide
          name={teamB.teamName}
          slug={teamB.slug}
          ovr={teamB.rating.ovr}
          won={result.winner === "B"}
          align="right"
        />
      </div>

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
          title={`${teamA.teamName} vs ${teamB.teamName} — 82-0 Plus`}
          path={`/m/${matchup.id}`}
          label="Share this result"
          className="w-full"
        />
      </div>
    </main>
  );
}
