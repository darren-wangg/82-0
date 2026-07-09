/**
 * Shared leaderboard board renderer used by /leaderboard (classic) and
 * /budget/leaderboard (per-cap budget boards). Loads the ranked rows for one
 * board, clamps the requested page, and renders the empty state, the ranked
 * list, and pagination. The pages own their headers and tab rows and pass in
 * how to build page hrefs.
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/contracts";
import {
  loadLeaderboardCount,
  loadLeaderboardEntries,
} from "@/app/api/_lib/leaderboard";
import { PAGE_SIZE } from "@/components/social/leaderboard";
import { Badge } from "@/components/ui/badge";
import { ClaimTeamButton } from "@/components/social/claim-team";
import { Unavailable } from "@/components/social/unavailable";
import type { BudgetDifficulty } from "@/lib/budget";
import type { TeamSize } from "@/lib/team-size";
import { cn } from "@/lib/utils";

interface LeaderboardViewProps {
  scope: "global" | "weekly";
  teamSize: TeamSize;
  /** 1-based page from the URL; clamped to the real range after counting. */
  requestedPage: number;
  /** "budget" filters to cap-drafted teams; omit for the classic board. */
  mode?: string;
  difficulty?: BudgetDifficulty;
  pageHref: (page: number) => string;
  /** Where "Be the first →" sends people when the board is empty. */
  emptyCtaHref: string;
}

export async function LeaderboardView({
  scope,
  teamSize,
  requestedPage,
  mode,
  difficulty,
  pageHref,
  emptyCtaHref,
}: LeaderboardViewProps) {
  let entries: LeaderboardEntry[];
  let totalPages: number;
  let page: number;

  try {
    const total = await loadLeaderboardCount(scope, teamSize, mode, difficulty);
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(requestedPage, totalPages);
    entries = await loadLeaderboardEntries(
      scope,
      teamSize,
      page - 1,
      mode,
      difficulty
    );
  } catch {
    return <Unavailable what="the leaderboard" />;
  }

  if (entries.length === 0) {
    return (
      <div className="mt-10 text-center text-sm text-muted-foreground">
        <p>No teams on the board yet.</p>
        <Link
          href={emptyCtaHref}
          className="mt-2 inline-block font-semibold text-primary"
        >
          Be the first →
        </Link>
      </div>
    );
  }

  return (
    <>
      <ol className="mt-4 space-y-1.5">
        {entries.map((e) => (
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
                <span className="truncate text-sm font-bold">{e.teamName}</span>
                {e.viewer && (
                  <Badge className="h-4 shrink-0 px-1.5 text-[10px] font-bold">
                    You
                  </Badge>
                )}
              </span>
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
            <span className="w-14 shrink-0 text-right font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {Math.round(e.ovr)} OVR
            </span>
          </li>
        ))}
      </ol>

      {totalPages > 1 && (
        <nav
          aria-label="Leaderboard pages"
          className="mt-5 flex items-center justify-center gap-4 text-sm font-semibold"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              rel="prev"
              aria-label="Previous page"
              className="flex size-9 items-center justify-center rounded-lg border border-border/80 text-foreground transition-colors hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-lg border border-border/40 text-muted-foreground/40">
              <ChevronLeft className="size-4" />
            </span>
          )}
          <span className="tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              rel="next"
              aria-label="Next page"
              className="flex size-9 items-center justify-center rounded-lg border border-border/80 text-foreground transition-colors hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-lg border border-border/40 text-muted-foreground/40">
              <ChevronRight className="size-4" />
            </span>
          )}
        </nav>
      )}
    </>
  );
}
