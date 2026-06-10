/**
 * /t/[slug] — shared team page: record hero, roster grid, 9-cat profile,
 * streaming AI analysis, and challenge/build CTAs.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SavedTeam } from "@/lib/contracts";
import { loadSavedTeam } from "@/app/api/_lib/teams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RecordHero } from "@/components/social/record-hero";
import { RosterGrid } from "@/components/social/roster-grid";
import { CatBars } from "@/components/social/cat-bars";
import { ExplainStream } from "@/components/social/explain-stream";
import { ShareButton } from "@/components/social/share-button";
import { Unavailable } from "@/components/social/unavailable";

export async function generateMetadata({
  params,
}: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const team = await loadSavedTeam(slug);
    if (!team) return { title: "Team not found" };
    return {
      title: `${team.teamName} (${team.season.wins}–${team.season.losses})`,
      description: `An all-time 8-player roster projected to go ${team.season.wins}–${team.season.losses}. Think you can beat it?`,
    };
  } catch {
    return { title: "Team" };
  }
}

export default async function TeamPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;

  let team: SavedTeam | null;
  try {
    team = await loadSavedTeam(slug);
  } catch {
    return <Unavailable what="this team" />;
  }
  if (!team) notFound();

  return (
    <main className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">{team.teamName}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          by {team.ownerDisplayName ?? "an anonymous GM"} ·{" "}
          {new Date(team.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <RecordHero season={team.season} rating={team.rating} />

      <RosterGrid roster={team.roster} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Category profile</CardTitle>
        </CardHeader>
        <CardContent>
          <CatBars profile={team.rating.catProfile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Scouting report</CardTitle>
        </CardHeader>
        <CardContent>
          <ExplainStream request={{ kind: "team", teamSlug: team.slug }} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Link
          href={`/t/${team.slug}/challenge`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Challenge this team
        </Link>
        <Link
          href="/play"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
        >
          Build your own
        </Link>
        <ShareButton
          title={`${team.teamName} — 82-0 Plus`}
          path={`/t/${team.slug}`}
          label="Share this team"
          className="w-full"
        />
      </div>
    </main>
  );
}
