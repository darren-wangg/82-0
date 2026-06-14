/**
 * /leaderboard — top 50 teams (global or weekly), wins desc then OVR desc,
 * scoped to the current snapshot version. Rows link to the team pages.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LeaderboardEntry } from "@/lib/contracts";
import { loadLeaderboardEntries } from "@/app/api/_lib/leaderboard";
import { Badge } from "@/components/ui/badge";
import { ClaimTeamButton } from "@/components/social/claim-team";
import { Unavailable } from "@/components/social/unavailable";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The winningest Ultimate Draft rosters ever drafted.",
};

export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const params = await searchParams;
  const scope = params.scope === "weekly" ? "weekly" : "global";
  const t = await getTranslations("home");
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );

  let entries: LeaderboardEntry[];
  try {
    entries = await loadLeaderboardEntries(scope, teamSize);
  } catch {
    return <Unavailable what="the leaderboard" />;
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">Leaderboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("teamSize")}
          </span>
          <TeamSizeSwitch value={teamSize} />
        </div>
      </div>

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
            // Stretched-link row: the <Link> overlays the whole card, and the
            // claim button (when shown) sits above it on its own z-layer — a
            // button nested inside an anchor would be invalid HTML.
            <li
              key={e.teamSlug}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border px-3 py-2.5 shadow-md shadow-black/25",
                e.viewer
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/80 bg-card/70"
              )}
            >
              <Link
                href={`/t/${e.teamSlug}`}
                aria-label={`${e.teamName}, ${e.wins}-${e.losses}`}
                className="absolute inset-0 rounded-xl"
              />
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
                {/* GM line only when a name was supplied; the viewer's own
                    unnamed entries offer the claim flow instead. */}
                {e.displayName ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.displayName}
                  </span>
                ) : e.viewer ? (
                  <ClaimTeamButton
                    slug={e.teamSlug}
                    teamName={e.teamName}
                    className="relative z-10"
                  />
                ) : null}
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
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
