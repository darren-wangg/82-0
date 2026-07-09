/**
 * /leaderboard — top 50 classic teams (global or weekly), wins desc then OVR
 * desc, scoped to the current snapshot version. Rows link to the team pages.
 *
 * Classic only, kept deliberately minimal. Budget teams are drafted under
 * per-difficulty salary caps and live on their own boards inside the budget
 * flow at /budget/leaderboard — never mixed in here.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LeaderboardView } from "@/components/social/leaderboard-view";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import { isBudgetDifficulty } from "@/lib/budget";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The winningest Ultimate Draft rosters ever drafted.",
};

export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const params = await searchParams;

  // Budget boards moved into the budget flow — keep old shared links working.
  if (params.board === "budget") {
    const d = Array.isArray(params.difficulty)
      ? params.difficulty[0]
      : params.difficulty;
    redirect(
      isBudgetDifficulty(d) && d !== "normal"
        ? `/budget/leaderboard?difficulty=${d}`
        : "/budget/leaderboard"
    );
  }

  const scope = params.scope === "weekly" ? "weekly" : "global";
  const t = await getTranslations("home");
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );

  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  /** Build a leaderboard href preserving the active scope. */
  const boardHref = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { scope, ...overrides };
    if (merged.scope === "weekly") sp.set("scope", "weekly");
    if (overrides.page && overrides.page !== "1") sp.set("page", overrides.page);
    const qs = sp.toString();
    return qs ? `/leaderboard?${qs}` : "/leaderboard";
  };

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">Leaderboard</h1>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="font-arcade text-[8px] text-muted-foreground uppercase">
            {t("teamSize")}
          </span>
          <TeamSizeSwitch value={teamSize} />
        </div>
      </div>

      {/* Scope tab (Global / This week) */}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 text-center text-xs font-semibold">
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
        pageHref={(p) => boardHref({ page: String(p) })}
        emptyCtaHref="/play"
      />
    </main>
  );
}
