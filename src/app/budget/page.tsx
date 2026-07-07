/**
 * /budget — Budget Matchups difficulty selector (server component).
 *
 * Choose Easy ($130), Normal ($100), or Hard ($75) to set the salary cap for
 * the budget draft. Links to /budget/play?difficulty={difficulty}.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUDGET_CAP, BUDGET_DIFFICULTIES } from "@/lib/budget";
import { preloadGameData } from "@/lib/preload-game-data";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import { TeamSizeSwitch } from "@/components/team-size-switch";

export const metadata: Metadata = {
  title: "Budget Draft — 82-0",
  description:
    "Draft a roster under a salary cap, then challenge a famous historical team.",
};

const DIFFICULTY_STYLES = {
  easy:   "border-emerald-400/50 bg-emerald-400/10  text-emerald-200 hover:bg-emerald-400/20",
  normal: "border-primary/50    bg-primary/10       text-primary    hover:bg-primary/20",
  hard:   "border-red-400/50    bg-red-400/10       text-red-300    hover:bg-red-400/20",
} as const;

export default async function BudgetPage() {
  // Warm the draft's data while the user picks a difficulty.
  preloadGameData();
  const t = await getTranslations("budget");
  const size = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
  const caps = BUDGET_CAP[size];

  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pt-12 pb-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label={t("backHome")}
            className="flex size-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl tracking-wide">
              {t("title")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        {/* Global roster-size toggle (5 / 8 / 10) — the same preference as the
            home screen. The chosen size sets the caps below and the draft
            roster size. */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="font-arcade text-[8px] text-muted-foreground uppercase">
              {t("rosterSize")}
            </span>
            <TeamSizeSwitch value={size} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {BUDGET_DIFFICULTIES.map((diff) => (
            <Link
              key={diff}
              href={`/budget/play?difficulty=${diff}`}
              className={cn(
                "flex items-center justify-between rounded-xl border px-5 py-4 transition-all active:scale-[0.98]",
                DIFFICULTY_STYLES[diff]
              )}
            >
              <div>
                <p className="font-display text-lg capitalize">
                  {t(`difficulty.${diff}`)}
                </p>
                <p className="text-xs opacity-70">{t(`difficultyHint.${diff}`)}</p>
              </div>
              <span className="font-mono text-2xl font-bold">${caps[diff]}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/leaderboard?board=budget"
          className="text-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          {t("viewLeaderboard")} →
        </Link>

        <p className="mt-auto text-center text-xs text-muted-foreground">
          {t("howPricing")}
        </p>
      </main>
    </div>
  );
}
