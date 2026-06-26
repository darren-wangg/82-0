"use client";

/**
 * Budget sim screen: shows the season result, then lets the user name their
 * team, pick a famous historical opponent, save to /api/budget/teams, and
 * fire a matchup via POST /api/matchups → redirect to /m/[id].
 *
 * Deliberately simpler than the classic SimScreen: no lobby, no redraft, no
 * share link — just the record, the OVR, and the challenge flow.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NINE_CATS,
  SEASON_GAMES,
  type MatchupResponse,
  type SaveTeamResponse,
} from "@/lib/contracts";
import { containsProfanity } from "@/lib/profanity";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { isBudgetDifficulty, type BudgetDifficulty } from "@/lib/budget";
import { priceMapOf } from "@/lib/pricing";
import { getSnapshot } from "@/lib/snapshot-client";
import { FAMOUS_TEAMS, type FamousTeam } from "@/lib/famous-teams";
import { toRoster } from "./draft-state";
import { freshSeed, useGame } from "./game-provider";
import { usePhaseGuard } from "./use-phase-guard";
import { CAT_LABELS } from "./format";

const RECORD_ANIM_S = 1.8;

function SimSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6" aria-busy>
      <Skeleton className="mx-auto h-20 w-56" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

/** Read difficulty persisted by BudgetPlayScreen. */
function readDifficulty(): BudgetDifficulty {
  try {
    const v = window.localStorage.getItem("ud:budget/difficulty") ?? "";
    return isBudgetDifficulty(v) ? v : "normal";
  } catch {
    return "normal";
  }
}

export function BudgetSimScreen() {
  const t = useTranslations("budget");
  const tSim = useTranslations("sim");
  const { state, dispatch, players } = useGame();
  const allowed = usePhaseGuard(["locked"]);
  const router = useRouter();

  const [teamName, setTeamName] = useState("");
  const [difficulty, setDifficulty] = useState<BudgetDifficulty>("normal");
  const [phase, setPhase] = useState<"record" | "challenge" | "saving" | "done">(
    "record"
  );
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  // Hydrate difficulty from localStorage once on the client.
  useEffect(() => {
    setDifficulty(readDifficulty());
  }, []);

  const sim = useMemo(() => {
    if (!state || state.status !== "locked") return null;
    const roster = toRoster(state);
    if (!roster) return null;
    const engine = getEngine();
    const rating = engine.teamRating(roster, players, getBaselines());
    const season = engine.projectSeason(rating);

    // Compute total spend for display.
    let totalSpend = 0;
    try {
      const snap = getSnapshot();
      const prices = priceMapOf(snap);
      const allIds = [...Object.values(roster.starters), ...roster.bench];
      totalSpend = allIds.reduce((s, id) => s + (prices.get(id) ?? 0), 0);
    } catch {
      // snapshot not ready
    }

    return { roster, rating, season, totalSpend };
  }, [state, players]);

  // Animated win count.
  const [displayWins, setDisplayWins] = useState(0);
  useEffect(() => {
    if (!sim) return;
    const target = sim.season.wins;
    const start = Date.now();
    const dur = RECORD_ANIM_S * 1000;
    const raf = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / dur);
      setDisplayWins(Math.round(target * Math.sqrt(t)));
      if (t < 1) requestAnimationFrame(raf);
    };
    const id = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(id);
  }, [sim]);

  const handleSaveAndChallenge = async (opponent: FamousTeam) => {
    if (savingRef.current || !state || !sim) return;
    const name = teamName.trim();
    if (!name) {
      setError(tSim("toastNameRequired"));
      return;
    }
    if (containsProfanity(name)) {
      setError(tSim("nameRejected"));
      return;
    }
    setError(null);
    savingRef.current = true;
    setPhase("saving");

    try {
      // Save the team to the budget route (server validates cap).
      const saveRes = await fetch("/api/budget/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: name,
          roster: sim.roster,
          snapshotVersion: state.snapshotVersion,
          difficulty,
        }),
      });

      if (saveRes.status === 409) {
        setError(tSim("toastStaleData"));
        setPhase("challenge");
        return;
      }
      if (saveRes.status === 422) {
        const data = (await saveRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error ?? t("budgetExceeded")
        );
        setPhase("challenge");
        return;
      }
      if (!saveRes.ok) throw new Error(`save failed: ${saveRes.status}`);
      const saveData: SaveTeamResponse = await saveRes.json();
      // Fire the matchup against the famous team.
      const matchupRes = await fetch("/api/matchups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSlugA: saveData.team.slug,
          teamSlugB: opponent.slug,
        }),
      });
      if (!matchupRes.ok) throw new Error(`matchup failed: ${matchupRes.status}`);
      const matchupData: MatchupResponse = await matchupRes.json();

      // Clear budget draft state so the next visit starts fresh.
      try {
        window.localStorage.removeItem("eighty-two-zero/budget/v1");
      } catch { /* storage unavailable */ }

      // Redirect to the existing matchup reveal page.
      router.push(`/m/${matchupData.id}`);
    } catch (err) {
      console.error(err);
      setError(t("challengeFailed"));
      setPhase("challenge");
      savingRef.current = false;
    }
  };

  if (!state || !allowed || !sim) return <SimSkeleton />;

  const { season, rating, totalSpend } = sim;
  const perfect = season.wins === SEASON_GAMES;

  return (
    <div className="flex min-h-dvh flex-1 flex-col overflow-y-auto px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Record reveal */}
      <div className="flex flex-col items-center gap-1 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}
          className={cn(
            "font-display text-7xl font-black leading-none tabular-nums tracking-tight",
            perfect ? "text-emerald-400" : "text-foreground"
          )}
        >
          {displayWins}
          <span className="text-3xl text-muted-foreground">
            -{SEASON_GAMES - season.wins}
          </span>
        </motion.div>
        <p className="mt-1 text-sm text-muted-foreground">
          {Math.round(rating.ovr)} OVR · OFF {Math.round(rating.offRating)} · DEF{" "}
          {Math.round(rating.defRating)}
        </p>
        {season.gatedCategory && (
          <p className="mt-0.5 text-xs text-amber-400">
            {tSim("gateCapped", {
              cat: CAT_LABELS[season.gatedCategory],
              wins: season.winCap,
            })}
          </p>
        )}
        {totalSpend > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("totalSpend", { spend: totalSpend, difficulty: t(`difficulty.${difficulty}`) })}
          </p>
        )}
      </div>

      {/* 9-cat profile mini-bars */}
      <div className="mt-5 rounded-xl border border-border/60 bg-card/60 p-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {tSim("nineCatProfile")}
        </p>
        <div className="grid grid-cols-3 gap-y-2 gap-x-3">
          {NINE_CATS.map((cat) => {
            const z = rating.catProfile[cat];
            const pct = Math.round(Math.min(100, Math.max(0, ((z + 3) / 6) * 100)));
            return (
              <div key={cat}>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>{CAT_LABELS[cat]}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      z >= 1 ? "bg-primary" : z >= 0 ? "bg-primary/60" : "bg-red-500/60"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main CTA flow */}
      <div className="mt-6 flex flex-1 flex-col gap-4">
        {phase === "record" && (
          <>
            <div>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={tSim("teamNamePlaceholder")}
                aria-label={tSim("teamNameAria")}
                maxLength={40}
                className="text-base"
              />
              {error && (
                <p className="mt-1 text-xs text-red-400">{error}</p>
              )}
            </div>
            <Button
              className="h-14 w-full rounded-2xl font-display text-lg"
              disabled={teamName.trim().length === 0}
              onClick={() => {
                if (!teamName.trim()) {
                  setError(tSim("toastNameRequired"));
                  return;
                }
                setError(null);
                setPhase("challenge");
              }}
            >
              {t("challengeCta")}
              <ChevronRight className="ml-1 size-5" />
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                dispatch({ type: "NEW_GAME", seed: freshSeed() });
                router.push("/budget/play");
              }}
            >
              {t("redraft")}
            </Button>
          </>
        )}

        {(phase === "challenge" || phase === "saving") && (
          <>
            <p className="text-sm font-semibold">{t("pickOpponent")}</p>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <ul className="flex flex-col gap-2">
              {FAMOUS_TEAMS.map((team) => (
                <li key={team.slug}>
                  <button
                    type="button"
                    disabled={phase === "saving"}
                    onClick={() => handleSaveAndChallenge(team)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors active:scale-[0.99]",
                      "border-border/80 bg-card/70 shadow-md shadow-black/20",
                      phase === "saving" && "opacity-50 cursor-wait"
                    )}
                  >
                    <div>
                      <p className="font-bold text-sm">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.era} · {team.blurb}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href="/leaderboard?mode=budget"
              className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <Trophy className="size-4" />
              {t("viewLeaderboard")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
