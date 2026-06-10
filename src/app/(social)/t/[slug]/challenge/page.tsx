/**
 * /t/[slug]/challenge — explains the head-to-head challenge and routes the
 * challenger into the draft with ?challenge={slug} so their finished team is
 * automatically matched up against this one.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SavedTeam } from "@/lib/contracts";
import { loadSavedTeam } from "@/app/api/_lib/teams";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Unavailable } from "@/components/social/unavailable";

export async function generateMetadata({
  params,
}: PageProps<"/t/[slug]/challenge">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const team = await loadSavedTeam(slug);
    return team
      ? {
          title: `Challenge ${team.teamName}`,
          description: `${team.teamName} went ${team.season.wins}–${team.season.losses}. Draft a roster and settle it in a best-of-7.`,
        }
      : { title: "Challenge" };
  } catch {
    return { title: "Challenge" };
  }
}

export default async function ChallengePage({
  params,
}: PageProps<"/t/[slug]/challenge">) {
  const { slug } = await params;

  let team: SavedTeam | null;
  try {
    team = await loadSavedTeam(slug);
  } catch {
    return <Unavailable what="this challenge" />;
  }
  if (!team) notFound();

  return (
    <main className="flex flex-1 flex-col justify-center space-y-6 text-center">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Head-to-head challenge
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Beat {team.teamName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {team.season.wins}–{team.season.losses} · OVR {Math.round(team.rating.ovr)}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 text-left text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">1.</span> Spin the
            wheel and draft your own 8-player all-time roster.
          </p>
          <p>
            <span className="font-semibold text-foreground">2.</span> When you
            save it, we simulate a best-of-7 series against{" "}
            <span className="font-semibold text-foreground">{team.teamName}</span>{" "}
            — same pairing, same result, every replay.
          </p>
          <p>
            <span className="font-semibold text-foreground">3.</span> Share the
            recap and talk your trash.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Link
          href={`/play?challenge=${team.slug}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Draft my team
        </Link>
        <Link
          href={`/t/${team.slug}`}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "w-full")}
        >
          Back to {team.teamName}
        </Link>
      </div>
    </main>
  );
}
