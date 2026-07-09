/**
 * /budget/leaderboard — budget boards, one per salary-cap difficulty. Teams
 * drafted under a cap are ranked only against teams built under the same cap
 * (?difficulty=easy|normal|hard, default normal), never against classic
 * teams. Lives inside the budget flow; the general /leaderboard stays
 * classic-only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { LeaderboardView } from "@/components/social/leaderboard-view";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import {
  BUDGET_DIFFICULTIES,
  isBudgetDifficulty,
  type BudgetDifficulty,
} from "@/lib/budget";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Budget Leaderboard — 82-0",
  description: "The best rosters drafted under each salary cap.",
};

/** Active-tab text color per budget cap — mirrors the /budget difficulty cards. */
const DIFFICULTY_TEXT = {
  easy: "text-emerald-300",
  normal: "text-primary",
  hard: "text-red-300",
} as const;

export default async function BudgetLeaderboardPage({
  searchParams,
}: PageProps<"/budget/leaderboard">) {
  const params = await searchParams;
  const scope = params.scope === "weekly" ? "weekly" : "global";
  const difficultyParam = Array.isArray(params.difficulty)
    ? params.difficulty[0]
    : params.difficulty;
  const difficulty: BudgetDifficulty = isBudgetDifficulty(difficultyParam)
    ? difficultyParam
    : "normal";
  const t = await getTranslations("budget");
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );

  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  /** Build a board href preserving the active cap + scope. */
  const boardHref = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { scope, difficulty, ...overrides };
    if (merged.difficulty !== "normal") sp.set("difficulty", merged.difficulty);
    if (merged.scope === "weekly") sp.set("scope", "weekly");
    if (overrides.page && overrides.page !== "1") sp.set("page", overrides.page);
    const qs = sp.toString();
    return qs ? `/budget/leaderboard?${qs}` : "/budget/leaderboard";
  };

  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-5 pb-12">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/budget"
              aria-label={t("title")}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <h1 className="font-display text-3xl tracking-wide">
              {t("viewLeaderboard")}
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="font-arcade text-[8px] text-muted-foreground uppercase">
              {t("rosterSize")}
            </span>
            <TeamSizeSwitch value={teamSize} />
          </div>
        </div>

        {/* Cap picker — one board per difficulty, colored like /budget cards. */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-muted/40 p-1 text-center text-xs font-semibold">
          {BUDGET_DIFFICULTIES.map((d) => (
            <Link
              key={d}
              href={boardHref({ difficulty: d, page: "1" })}
              className={cn(
                "rounded-lg py-1 whitespace-nowrap",
                difficulty === d
                  ? cn("bg-card", DIFFICULTY_TEXT[d])
                  : "text-muted-foreground"
              )}
            >
              <span className="opacity-60">$</span>
              {t(`difficulty.${d}`)}
            </Link>
          ))}
        </div>

        {/* Scope tab (Global / This week) */}
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 text-center text-xs font-semibold">
          {(["global", "weekly"] as const).map((s) => (
            <Link
              key={s}
              href={boardHref({ scope: s, page: "1" })}
              className={cn(
                "rounded-lg py-1 capitalize",
                scope === s ? "bg-card text-foreground" : "text-muted-foreground"
              )}
            >
              {s === "weekly" ? "This week" : "All time"}
            </Link>
          ))}
        </div>

        <LeaderboardView
          scope={scope}
          teamSize={teamSize}
          requestedPage={requestedPage}
          mode="budget"
          difficulty={difficulty}
          pageHref={(p) => boardHref({ page: String(p) })}
          emptyCtaHref="/budget"
        />
      </main>
    </div>
  );
}
