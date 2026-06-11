/**
 * /leaderboard — top 50 teams (global or weekly), wins desc then OVR desc,
 * scoped to the current snapshot version. Rows link to the team pages.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardEntry } from "@/lib/contracts";
import { getAnonIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSnapshot } from "@/lib/snapshot";
import {
  LEADERBOARD_SIZE,
  rankLeaderboard,
  WEEKLY_WINDOW_MS,
} from "@/components/social/leaderboard";
import { ownerDisplayName, teamInclude } from "@/app/api/_lib/teams";
import { Badge } from "@/components/ui/badge";
import { Unavailable } from "@/components/social/unavailable";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The winningest 82-0 Plus rosters ever drafted.",
};

async function loadEntries(scope: "global" | "weekly"): Promise<LeaderboardEntry[]> {
  // Read-only: flags this device's own entries ("You") without creating an identity.
  const anonId = await getAnonIdFromCookie();
  const teams = await prisma.team.findMany({
    where: {
      snapshotVersion: getSnapshot().version,
      ...(scope === "weekly"
        ? { createdAt: { gte: new Date(Date.now() - WEEKLY_WINDOW_MS) } }
        : {}),
    },
    orderBy: [{ wins: "desc" }, { ovr: "desc" }],
    take: LEADERBOARD_SIZE,
    include: teamInclude,
  });
  return rankLeaderboard(
    teams.map((t) => ({
      teamSlug: t.slug,
      teamName: t.teamName,
      displayName: ownerDisplayName(t),
      wins: t.wins,
      losses: t.losses,
      ovr: t.ovr,
      viewer: anonId !== null && t.anonIdentityId === anonId,
    }))
  );
}

export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const params = await searchParams;
  const scope = params.scope === "weekly" ? "weekly" : "global";

  let entries: LeaderboardEntry[];
  try {
    entries = await loadEntries(scope);
  } catch {
    return <Unavailable what="the leaderboard" />;
  }

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="font-display text-3xl tracking-wide">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The winningest rosters ever drafted.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-center text-sm font-semibold">
        {(["global", "weekly"] as const).map((s) => (
          <Link
            key={s}
            href={s === "global" ? "/leaderboard" : "/leaderboard?scope=weekly"}
            className={cn(
              "rounded-lg py-1.5 capitalize",
              scope === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {s === "weekly" ? "This week" : "All time"}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          <p>No teams on the board yet.</p>
          <Link href="/play" className="mt-2 inline-block font-semibold text-primary">
            Be the first →
          </Link>
        </div>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {entries.map((e) => (
            <li key={e.teamSlug}>
              <Link
                href={`/t/${e.teamSlug}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 shadow-md shadow-black/25",
                  e.viewer
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/80 bg-card/70"
                )}
              >
                <span
                  className={cn(
                    "w-7 shrink-0 text-center font-display text-base",
                    e.rank === 1
                      ? "text-amber-300"
                      : e.rank <= 3
                        ? "text-primary"
                        : "text-muted-foreground"
                  )}
                >
                  {e.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">
                      {e.teamName}
                    </span>
                    {e.viewer && (
                      <Badge className="h-4 shrink-0 px-1.5 text-[10px] font-bold">
                        You
                      </Badge>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.displayName ?? "anonymous GM"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm font-bold tabular-nums",
                    e.losses === 0 ? "text-emerald-400" : undefined
                  )}
                >
                  {e.wins}-{e.losses}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {Math.round(e.ovr)} OVR
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
