"use client";

/**
 * Budget sim screen. Shows the *exact same* post-draft reveal as the classic
 * SimScreen (animated record count-up, roster headshots, OVR/OFF/DEF, 9-cat
 * profile, "what cost you", streamed AI scouting, plus download-card and
 * save-to-device actions) via the shared <TeamRevealBody>. The only budget
 * additions are the spend summary and the famous-team challenge flow:
 * name → pick a historical opponent → save to /api/budget/teams (server
 * validates the cap) → POST /api/matchups → redirect to /m/[id].
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, RotateCcw, Save as SaveIcon, Trophy } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SEASON_GAMES,
  type MatchupResponse,
  type SaveTeamResponse,
} from "@/lib/contracts";
import { containsProfanity } from "@/lib/profanity";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getSnapshot } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { isBudgetDifficulty, type BudgetDifficulty } from "@/lib/budget";
import { priceMapOf } from "@/lib/pricing";
import { FAMOUS_TEAMS, type FamousTeam } from "@/lib/famous-teams";
import { DownloadCardButton } from "@/components/social/download-card";
import { analyzeCost } from "./cost-analysis";
import { Confetti } from "./confetti";
import { toRoster } from "./draft-state";
import { freshSeed, useGame } from "./game-provider";
import { saveLocalTeam } from "./local-teams";
import { usePhaseGuard } from "./use-phase-guard";
import { COUNT_UP_SECONDS, TeamRevealBody } from "./team-reveal";

/** Read difficulty persisted by BudgetPlayScreen. */
function readDifficulty(): BudgetDifficulty {
  try {
    const v = window.localStorage.getItem("ud:budget/difficulty") ?? "";
    return isBudgetDifficulty(v) ? v : "normal";
  } catch {
    return "normal";
  }
}

function SimSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4" aria-busy>
      <div className="flex justify-end gap-2">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <Skeleton className="mx-auto h-20 w-56" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

export function BudgetSimScreen() {
  const t = useTranslations("budget");
  const tSim = useTranslations("sim");
  const { state, dispatch, ctx, players } = useGame();
  const allowed = usePhaseGuard(["locked"]);
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [teamName, setTeamName] = useState("");
  const [difficulty, setDifficulty] = useState<BudgetDifficulty>("normal");
  const [step, setStep] = useState<"record" | "challenge" | "saving">("record");
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  // Save-to-device dialog (mirrors the classic sim screen).
  const [localOpen, setLocalOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [localSaved, setLocalSaved] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

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
    const cost = analyzeCost(roster, rating, season, players, getBaselines(), {
      considerBench: roster.bench.length > 3,
    });
    let totalSpend = 0;
    try {
      const prices = priceMapOf(getSnapshot());
      const allIds = [...Object.values(roster.starters), ...roster.bench];
      totalSpend = allIds.reduce((s, id) => s + (prices.get(id) ?? 0), 0);
    } catch {
      // snapshot not ready — spend line just hides
    }
    return { roster, rating, season, cost, totalSpend };
  }, [state, players]);

  const saveToDevice = () => {
    if (!state || !sim) return;
    const name = localName.trim();
    if (name.length === 0 || name.length > 40) {
      setDeviceError(tSim("toastNameRequired"));
      return;
    }
    if (containsProfanity(name)) {
      setDeviceError(tSim("nameRejected"));
      return;
    }
    setDeviceError(null);
    const ok = saveLocalTeam({
      name,
      roster: sim.roster,
      snapshotVersion: state.snapshotVersion,
      rating: sim.rating,
      season: sim.season,
    });
    if (!ok) {
      setDeviceError(tSim("toastDeviceSaveFailed"));
      return;
    }
    setLocalSaved(true);
  };

  const saveAndChallenge = async (opponent: FamousTeam) => {
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
    setStep("saving");
    try {
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
        setStep("challenge");
        savingRef.current = false;
        return;
      }
      if (saveRes.status === 422) {
        const data = (await saveRes.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? t("budgetExceeded"));
        setStep("challenge");
        savingRef.current = false;
        return;
      }
      if (!saveRes.ok) throw new Error(`save failed: ${saveRes.status}`);
      const saveData: SaveTeamResponse = await saveRes.json();

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

      try {
        window.localStorage.removeItem("eighty-two-zero/budget/v1");
      } catch {
        /* storage unavailable */
      }
      router.push(`/m/${matchupData.id}`);
    } catch {
      setError(t("challengeFailed"));
      setStep("challenge");
      savingRef.current = false;
    }
  };

  if (!state || !allowed || !sim) return <SimSkeleton />;

  const { roster, rating, season, cost, totalSpend } = sim;
  const perfect = season.wins === SEASON_GAMES;
  const cardUrl = `/api/draft-card?r=${encodeURIComponent(JSON.stringify(roster))}`;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {perfect && !reducedMotion && <Confetti delay={COUNT_UP_SECONDS} />}

      {/* download image + save (device), top right — same as the classic screen */}
      <div className="flex justify-end gap-2">
        <DownloadCardButton
          cardUrl={cardUrl}
          fileName="budget-team-card.png"
          label=""
          ariaLabel={tSim("downloadCardAria")}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "rounded-full"
          )}
        />
        <Dialog
          open={localOpen}
          onOpenChange={(open) => {
            setLocalOpen(open);
            if (!open) {
              setLocalSaved(false);
              setDeviceError(null);
            }
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={tSim("saveToDeviceAria")}
                className="rounded-full"
              />
            }
          >
            <SaveIcon className="size-4" />
          </DialogTrigger>
          <DialogContent className="dark border-border bg-background text-foreground">
            <DialogHeader>
              <DialogTitle>{tSim("deviceDialogTitle")}</DialogTitle>
              <DialogDescription>{tSim("deviceDialogDescription")}</DialogDescription>
            </DialogHeader>
            {localSaved ? (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-emerald-400" /> {tSim("savedToDevice")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  value={localName}
                  maxLength={40}
                  placeholder={tSim("teamNamePlaceholder")}
                  aria-label={tSim("teamNameAria")}
                  className="h-11 rounded-xl"
                  onChange={(e) => {
                    setLocalName(e.target.value);
                    if (deviceError) setDeviceError(null);
                  }}
                />
                {deviceError && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {deviceError}
                  </p>
                )}
                <Button
                  className="h-12 w-full rounded-xl text-base font-bold"
                  disabled={localName.trim().length === 0}
                  onClick={saveToDevice}
                >
                  <SaveIcon className="size-4" /> {tSim("save")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* shared reveal — identical to the classic sim screen */}
      <TeamRevealBody
        roster={roster}
        rating={rating}
        season={season}
        cost={cost}
        players={players}
        benchSlots={ctx.mode?.benchSlots ?? []}
        snapshotVersion={state.snapshotVersion}
      />

      {/* budget footer: spend summary + famous-team challenge flow */}
      <div className="sticky bottom-0 mt-6 flex flex-col gap-3 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {totalSpend > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {t("totalSpend", {
              spend: totalSpend,
              difficulty: t(`difficulty.${difficulty}`),
            })}
          </p>
        )}

        {step === "record" ? (
          <>
            <Input
              value={teamName}
              maxLength={40}
              placeholder={tSim("teamNamePlaceholder")}
              aria-label={tSim("teamNameAria")}
              className="h-11 rounded-xl"
              onChange={(e) => {
                setTeamName(e.target.value);
                if (error) setError(null);
              }}
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button
              className="h-14 w-full rounded-2xl font-display text-lg tracking-wide shadow-lg shadow-primary/30"
              disabled={teamName.trim().length === 0}
              onClick={() => {
                if (!teamName.trim()) {
                  setError(tSim("toastNameRequired"));
                  return;
                }
                setError(null);
                setStep("challenge");
              }}
            >
              {t("challengeCta")} <ChevronRight className="size-5" />
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-sm font-bold"
              onClick={() => {
                dispatch({ type: "NEW_GAME", seed: freshSeed() });
                router.push("/budget");
              }}
            >
              {t("redraft")} <RotateCcw className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">{t("pickOpponent")}</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <ul className="flex flex-col gap-2">
              {FAMOUS_TEAMS.map((team) => (
                <li key={team.slug}>
                  <button
                    type="button"
                    disabled={step === "saving"}
                    onClick={() => saveAndChallenge(team)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border border-border/80 bg-card/70 px-4 py-3 text-left shadow-md shadow-black/20 transition-transform active:scale-[0.99]",
                      step === "saving" && "cursor-wait opacity-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{team.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {team.era} · {team.blurb}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href="/leaderboard?mode=budget"
              className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <Trophy className="size-4" /> {t("viewLeaderboard")}
            </Link>
          </>
        )}
      </div>

      <AnimatePresence>
        {error && step !== "record" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
