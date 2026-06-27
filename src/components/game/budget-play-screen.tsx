"use client";

/**
 * Budget-aware draft screen. Built on the same GameProvider / draft-state
 * infrastructure as the classic PlayScreen, with three additions:
 *   1. A budget meter under the progress bar (Spent $X / $CAP).
 *   2. Per-player $price badges in the pool list.
 *   3. A hard cap: players you can't afford are non-draftable (greyed out),
 *      so the running total can never exceed the cap. The server re-validates
 *      the cap on save as a backstop.
 *
 * Spin/reels/slots/roster board are reused wholesale from the classic path.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCcw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DECADES, DRAFT_ROUNDS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import {
  canSkipEra,
  canSkipTeam,
  draftablePool,
  pickablePool,
} from "./draft-state";
import { DECADE_COLORS } from "./format";
import { freshSeed, useGame } from "./game-provider";
import { PoolList } from "./pool-list";
import { RosterBoard } from "./roster-board";
import { SlotReel } from "./slot-reel";
import { usePhaseGuard } from "./use-phase-guard";
import { BudgetMeter } from "./budget-meter";
import type { BudgetDifficulty } from "@/lib/budget";
import { BUDGET_CAP, isBudgetDifficulty } from "@/lib/budget";
import { priceMapOf, PRICE_MIN } from "@/lib/pricing";
import { getSnapshot } from "@/lib/snapshot-client";

const REEL_MS = 3900;
const FRANCHISE_REEL_S = 3.0;
const DECADE_REEL_DELAY_S = 0.6;
const PLACEHOLDER_TEAM = "Chicago Bulls";
const PLACEHOLDER_ERA = "1990s";

function BudgetPlaySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-6 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-auto flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

export function BudgetPlayScreen() {
  const t = useTranslations("play");
  const { state, dispatch, ctx, players, franchiseById } = useGame();
  const allowed = usePhaseGuard(["draft"]);
  const rounds = ctx.mode?.draftRounds ?? DRAFT_ROUNDS;

  const router = useRouter();
  const searchParams = useSearchParams();
  const difficultyParam = searchParams.get("difficulty");
  const difficulty: BudgetDifficulty = isBudgetDifficulty(difficultyParam)
    ? difficultyParam
    : "normal";
  const cap = BUDGET_CAP[difficulty];

  // Persist difficulty in localStorage so /budget/sim can read it after redirect.
  useEffect(() => {
    try {
      window.localStorage.setItem("ud:budget/difficulty", difficulty);
    } catch {
      // storage unavailable — best-effort
    }
  }, [difficulty]);

  // Compute price map once snapshot is available (client-side).
  const priceMap = useMemo(() => {
    try {
      const snap = getSnapshot();
      return priceMapOf(snap);
    } catch {
      return null; // snapshot not yet loaded
    }
  }, []);

  // Track how much has been spent on placed players.
  const spent = useMemo(() => {
    if (!priceMap || !state) return 0;
    return Object.values(state.slots)
      .filter((id): id is string => id !== null)
      .reduce((sum, id) => sum + (priceMap.get(id) ?? 0), 0);
  }, [priceMap, state]);

  const remaining = cap - spent;

  // Every still-empty slot after the current pick needs at least the $5 floor,
  // so the most you may spend on this pick is the remaining cap minus a $5
  // reserve per later slot. This stops you blowing the whole budget early and
  // getting stranded with $0 for the final pick(s).
  const slotsAfterThisPick = Math.max(0, rounds - (state?.picks.length ?? 0) - 1);
  const spendableNow = remaining - PRICE_MIN * slotsAfterThisPick;

  const [settledNonce, setSettledNonce] = useState(-1);
  const spinNonce = state?.spinNonce ?? 0;
  const hasSpin = state?.spin != null;
  const spinning = hasSpin && settledNonce !== spinNonce;

  useEffect(() => {
    if (!hasSpin) return;
    const timeout = window.setTimeout(() => setSettledNonce(spinNonce), REEL_MS);
    return () => window.clearTimeout(timeout);
  }, [spinNonce, hasSpin]);

  const franchiseNames = useMemo(
    () => Object.keys(ctx.pools).map((id) => franchiseById.get(id)?.name ?? id),
    [ctx, franchiseById]
  );

  if (!state || !allowed) return <BudgetPlaySkeleton />;

  const spin = state.spin;
  const pool = spin
    ? pickablePool(state, ctx, spin.franchiseId, spin.decade).flatMap(
        (id) => players.get(id) ?? []
      )
    : [];
  const draftable = spin
    ? new Set(draftablePool(state, ctx, spin.franchiseId, spin.decade))
    : new Set<string>();
  const franchiseName = spin
    ? (franchiseById.get(spin.franchiseId)?.name ?? spin.franchiseId)
    : null;

  const settled = spin !== null && !spinning;
  const skipTeamOk = settled && canSkipTeam(state, ctx);
  const skipEraOk = settled && canSkipEra(state, ctx);

  // Redraft returns to the difficulty selector (a fresh budget run starts by
  // re-picking a cap), matching the sim screen's "Redraft" button.
  const newGame = () => {
    if (state.picks.length > 0 && !window.confirm(t("confirmNewGame"))) return;
    dispatch({ type: "NEW_GAME", seed: freshSeed() });
    router.push("/budget");
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {/* header: progress + respins */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold">
              {t("pick")}{" "}
              <motion.span
                key={state.picks.length}
                initial={{ scale: 1.5, color: "var(--primary)" }}
                animate={{ scale: 1, color: "var(--foreground)" }}
                transition={{ type: "spring", stiffness: 400, damping: 16 }}
                className="inline-block font-mono tabular-nums"
              >
                {t("countOf", {
                  current: Math.min(state.picks.length + 1, rounds),
                  total: rounds,
                })}
              </motion.span>
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("newDraftAria")}
              className="text-muted-foreground"
              onClick={newGame}
            >
              <RotateCcw />
            </Button>
          </div>
          <Progress
            value={(state.picks.length / rounds) * 100}
            className="mt-1 w-28"
            aria-label={t("progressAria")}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-red-500/60 px-3 font-bold text-red-400 shadow-md shadow-red-950/50 transition-transform active:scale-95 disabled:opacity-35 disabled:grayscale"
            disabled={!skipTeamOk}
            onClick={() => dispatch({ type: "SKIP_TEAM" })}
          >
            {t("teamRespin")} <RefreshCcw className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-orange-500/60 px-3 font-bold text-orange-400 shadow-md shadow-orange-950/50 transition-transform active:scale-95 disabled:opacity-35 disabled:grayscale"
            disabled={!skipEraOk}
            onClick={() => dispatch({ type: "SKIP_ERA" })}
          >
            {t("eraRespin")} <RefreshCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Budget meter — always visible during the budget draft */}
      <BudgetMeter spent={spent} cap={cap} className="mt-1.5" />

      {/* slot machine */}
      <div className="mt-3 flex shrink-0 items-stretch gap-2.5">
        <SlotReel
          value={franchiseName}
          items={franchiseNames}
          nonce={state.spinNonce}
          duration={FRANCHISE_REEL_S}
          idleLabel={PLACEHOLDER_TEAM}
          className="flex-[1.6] rounded-xl bg-card shadow-lg shadow-black/40 ring-2 ring-red-500/50"
          rowClassName="font-display text-lg tracking-wide text-center leading-tight px-1"
        />
        <SlotReel
          value={spin?.decade ?? null}
          items={[...DECADES]}
          nonce={state.spinNonce}
          duration={FRANCHISE_REEL_S - 0.2}
          delay={DECADE_REEL_DELAY_S}
          idleLabel={PLACEHOLDER_ERA}
          className={cn(
            "flex-1 rounded-xl bg-card shadow-lg shadow-black/40 ring-2 transition-shadow",
            settled && spin ? DECADE_COLORS[spin.decade].ring : "ring-orange-500/50"
          )}
          rowClassName={cn(
            "font-display text-2xl tracking-wider",
            spin ? DECADE_COLORS[spin.decade].text : "text-primary"
          )}
        />
      </div>

      {/* player pool */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {spin === null ? (
            <motion.div
              key="cta"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="w-full"
              >
                <Button
                  className="h-16 w-full rounded-2xl bg-gradient-to-r from-primary via-orange-400 to-primary bg-[length:200%_100%] bg-left font-display text-2xl tracking-wide shadow-xl shadow-primary/30 transition-[transform,background-position] duration-500 hover:bg-right active:scale-95"
                  onClick={() => dispatch({ type: "SPIN" })}
                >
                  {t("spin")}
                </Button>
              </motion.div>
            </motion.div>
          ) : spinning ? (
            <motion.div
              key="rolling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center gap-1.5"
            >
              {t("spinning").split("").map((ch, i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.08 }}
                  className="font-arcade text-sm text-primary/80"
                >
                  {ch}
                </motion.span>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={`pool-${state.spinNonce}`}
              className="flex min-h-0 flex-1 flex-col"
            >
              <PoolList
                pool={pool}
                selectedId={state.selectedPlayerId}
                // Hard cap: a player you can't afford isn't draftable. Uses the
                // $5-per-later-slot reserve so you always keep enough to fill the
                // rest. The server re-validates the cap on save as a backstop.
                isDraftable={(id) =>
                  draftable.has(id) && (priceMap?.get(id) ?? 0) <= spendableNow
                }
                onSelect={(playerId) => dispatch({ type: "SELECT_PLAYER", playerId })}
                priceMap={priceMap}
                remainingBudget={spendableNow}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* roster board — PLACE goes through the standard reducer; server rejects over-budget saves */}
      <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-background to-transparent pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <RosterBoard />
      </div>
    </div>
  );
}
