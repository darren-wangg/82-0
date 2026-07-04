/**
 * /t/[slug] — shared team page: record hero, roster grid, 9-cat profile,
 * streaming AI analysis, and challenge/build CTAs.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter } from "next-intl/server";
import { Suspense } from "react";
import { SavedTeam } from "@/lib/contracts";
import { headshotSources } from "@/lib/headshots";
import { getPlayerMap } from "@/lib/snapshot";
import { loadSavedTeam } from "@/app/api/_lib/teams";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DownloadCardButton } from "@/components/social/download-card";
import { RecordHero } from "@/components/social/record-hero";
import { RosterGrid } from "@/components/social/roster-grid";
import { BattleHistory } from "@/components/social/battle-history";
import { CatBars } from "@/components/social/cat-bars";
import { CatProfileInfo } from "@/components/social/cat-profile-info";
import { ExplainStream } from "@/components/social/explain-stream";
import { ShareButton } from "@/components/social/share-button";
import { Unavailable } from "@/components/social/unavailable";

/** Rendered per request: the root layout reads the `ud:locale` cookie to pick
 *  the language, which opts every route into dynamic rendering — so this share
 *  page can't be ISR-cached while i18n is cookie-driven (see docs/scaling.md).
 *  Without it Next attempts static generation and the cookie read throws
 *  DYNAMIC_SERVER_USAGE. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const team = await loadSavedTeam(slug);
    if (!team) return { title: "Team not found" };
    const title = `${team.teamName} (${team.season.wins}–${team.season.losses})`;
    const description = `An all-time ${5 + team.roster.bench.length}-player roster projected to go ${team.season.wins}–${team.season.losses}. Think you can beat it?`;
    // openGraph/twitter must be set here too: metadata merges shallowly, so
    // without them the root layout's static og:title/og:description win and
    // every shared team link unfurls identically.
    return {
      title,
      description,
      openGraph: { title, description, siteName: "Ultimate Draft", type: "website" },
      twitter: { card: "summary_large_image", title, description },
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

  const format = await getFormatter();

  return (
    <main className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">{team.teamName}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {team.ownerDisplayName ? `by ${team.ownerDisplayName} · ` : ""}
          {format.dateTime(new Date(team.createdAt), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <RecordHero season={team.season} rating={team.rating} />

      <RosterGrid
        roster={team.roster}
        players={getPlayerMap()}
        headshotSrcs={headshotSources}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            Category profile <CatProfileInfo />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CatBars profile={team.rating.catProfile} />
        </CardContent>
      </Card>

      {/* Streams in after the hero/roster paint — it's a separate DB query. */}
      <Suspense fallback={null}>
        <BattleHistory slug={team.slug} />
      </Suspense>

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
          title={`${team.teamName} — Ultimate Draft`}
          path={`/t/${team.slug}`}
          label="Share this team"
          className="w-full"
        />
        <DownloadCardButton
          cardUrl={`/t/${team.slug}/card`}
          fileName={`ultimate-draft-${team.slug}.png`}
          label="Save team card"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full"
          )}
        />
      </div>
    </main>
  );
}
