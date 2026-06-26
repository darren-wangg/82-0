"use client";

/**
 * Budget challenge screen — a full, standalone page (not an overlay) for
 * picking the famous historical opponent after a budget team is saved.
 *
 * Reached via /budget/challenge?team=<slug>&name=<teamName>&difficulty=<diff>.
 * The team is already persisted (saved on the sim screen), so this screen only
 * needs the slug: tapping an opponent fires POST /api/matchups and redirects to
 * the shared /m/[id] reveal. Opponent OVRs are computed client-side for a
 * strength hint; failure degrades gracefully (badge just hides).
 */

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2, Trophy } from "lucide-react";
import type { MatchupResponse } from "@/lib/contracts";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getPlayerMap } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { FAMOUS_TEAMS, type FamousTeam } from "@/lib/famous-teams";

export function BudgetChallengeScreen() {
  const t = useTranslations("budget");
  const router = useRouter();
  const params = useSearchParams();
  const teamSlug = params.get("team") ?? "";
  const teamName = params.get("name") ?? "";
  const difficulty = params.get("difficulty") ?? "normal";
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Strength hint: compute each famous team's OVR once, client-side. Memoized
  // and wrapped so a snapshot-not-ready race just drops the badges.
  const ovrBySlug = useMemo(() => {
    const map = new Map<string, number>();
    try {
      const engine = getEngine();
      const players = getPlayerMap();
      const baselines = getBaselines();
      for (const ft of FAMOUS_TEAMS) {
        map.set(ft.slug, engine.teamRating(ft.roster, players, baselines).ovr);
      }
    } catch {
      // snapshot not ready — badges hide
    }
    return map;
  }, []);

  const challenge = async (opponent: FamousTeam) => {
    if (pending || !teamSlug) return;
    setError(null);
    setPending(opponent.slug);
    try {
      const res = await fetch("/api/matchups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlugA: teamSlug, teamSlugB: opponent.slug }),
      });
      if (!res.ok) throw new Error(`matchup failed: ${res.status}`);
      const data: MatchupResponse = await res.json();
      router.push(`/m/${data.id}`);
    } catch {
      setError(t("challengeFailed"));
      setPending(null);
    }
  };

  return (
    <main className="flex flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 pt-2 pb-4">
        <Link
          href="/budget/sim"
          aria-label={t("backToSummary")}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-xl tracking-wide">
            {t("challengeCta")}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {teamName || t("pickOpponent")}
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-4">
        {FAMOUS_TEAMS.map((team) => {
          const ovr = ovrBySlug.get(team.slug);
          const loading = pending === team.slug;
          return (
            <li key={team.slug}>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => challenge(team)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-4 py-3 text-left shadow-md shadow-black/20 transition-transform active:scale-[0.99]",
                  pending !== null && !loading && "opacity-40",
                  loading && "cursor-wait"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{team.name}</p>
                    {ovr !== undefined && (
                      <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                        OVR {ovr}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {team.era} · {team.blurb}
                  </p>
                </div>
                {loading ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href={`/leaderboard?mode=budget&difficulty=${difficulty}`}
        className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <Trophy className="size-4" /> {t("viewLeaderboard")}
      </Link>
    </main>
  );
}
