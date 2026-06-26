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
import { useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Loader2, RotateCcw, Save as SaveIcon } from "lucide-react";
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
import { SEASON_GAMES, type SaveTeamResponse } from "@/lib/contracts";
import { containsProfanity } from "@/lib/profanity";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getSnapshot } from "@/lib/snapshot-client";
import { cn } from "@/lib/utils";
import { isBudgetDifficulty, type BudgetDifficulty } from "@/lib/budget";
import { priceMapOf } from "@/lib/pricing";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  // Cache the saved slug so navigating back and re-tapping Challenge reuses the
  // same persisted team instead of creating a duplicate row each time.
  const savedSlugRef = useRef<string | null>(null);

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

  // Save the budget team (server validates the cap), then route to the dedicated
  // opponent-picker screen. The matchup itself is created there, on pick.
  const saveAndGoToChallenge = async () => {
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

    const goTo = (slug: string) =>
      router.push(
        `/budget/challenge?team=${encodeURIComponent(slug)}` +
          `&name=${encodeURIComponent(name)}&difficulty=${difficulty}`
      );

    // Already saved (user came back to re-pick) — skip the duplicate write.
    if (savedSlugRef.current) {
      goTo(savedSlugRef.current);
      return;
    }

    savingRef.current = true;
    setSaving(true);
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
        return;
      }
      if (saveRes.status === 422) {
        const data = (await saveRes.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? t("budgetExceeded"));
        return;
      }
      if (!saveRes.ok) throw new Error(`save failed: ${saveRes.status}`);
      const saveData: SaveTeamResponse = await saveRes.json();
      savedSlugRef.current = saveData.team.slug;
      goTo(saveData.team.slug);
    } catch {
      setError(t("challengeFailed"));
    } finally {
      savingRef.current = false;
      setSaving(false);
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
          disabled={teamName.trim().length === 0 || saving}
          onClick={saveAndGoToChallenge}
        >
          {saving ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              {t("challengeCta")} <ChevronRight className="size-5" />
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full rounded-2xl text-sm font-bold"
          disabled={saving}
          onClick={() => {
            dispatch({ type: "NEW_GAME", seed: freshSeed() });
            router.push("/budget");
          }}
        >
          {t("redraft")} <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
