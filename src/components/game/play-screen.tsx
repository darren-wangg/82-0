"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

/** Reel roll time (franchise reel + staggered decade reel), in ms. */
const REEL_MS = 3100;
const FRANCHISE_REEL_S = 2.4;
const DECADE_REEL_DELAY_S = 0.5;

function PlaySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-auto flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

export function PlayScreen() {
  const { state, dispatch, ctx, players, franchiseById } = useGame();
  const allowed = usePhaseGuard(["draft"]);

  // Nonce of the last spin whose reel animation has finished. Every (re)spin —
  // including a restored pending spin on mount — counts as a reel roll: the
  // pool and skips unlock only once the reels settle.
  const [settledNonce, setSettledNonce] = useState(-1);

  const spinNonce = state?.spinNonce ?? 0;
  const hasSpin = state?.spin != null;
  const spinning = hasSpin && settledNonce !== spinNonce;

  useEffect(() => {
    if (!hasSpin) return;
    const t = window.setTimeout(() => setSettledNonce(spinNonce), REEL_MS);
    return () => window.clearTimeout(t);
  }, [spinNonce, hasSpin]);

  const franchiseNames = useMemo(
    () => Object.keys(ctx.pools).map((id) => franchiseById.get(id)?.name ?? id),
    [ctx, franchiseById]
  );

  if (!state || !allowed) return <PlaySkeleton />;

  const spin = state.spin;
  const decadeItems = DECADES.filter((d) => !state.excludedDecades.includes(d));
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

  const newGame = () => {
    if (
      state.picks.length > 0 &&
      !window.confirm("Scrap this draft and start over?")
    ) {
      return;
    }
    dispatch({ type: "NEW_GAME", seed: freshSeed() });
  };

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col overflow-hidden px-4 pt-3">
      {/* header: progress left, respins top right */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold">
              Pick{" "}
              <span className="font-mono tabular-nums">
                {Math.min(state.picks.length + 1, DRAFT_ROUNDS)} of {DRAFT_ROUNDS}
              </span>
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New draft"
              className="text-muted-foreground"
              onClick={newGame}
            >
              <RotateCcw />
            </Button>
          </div>
          <Progress
            value={(state.picks.length / DRAFT_ROUNDS) * 100}
            className="mt-1 w-28"
            aria-label="Draft progress"
          />
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg px-2.5"
            disabled={!skipTeamOk}
            onClick={() => dispatch({ type: "SKIP_TEAM" })}
          >
            <Shuffle className="size-3.5" /> Team
            <Badge variant="secondary" className="px-1 font-mono">
              {state.teamSkipsLeft}
            </Badge>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg px-2.5"
            disabled={!skipEraOk}
            onClick={() => dispatch({ type: "SKIP_ERA" })}
          >
            <Shuffle className="size-3.5" /> Era
            <Badge variant="secondary" className="px-1 font-mono">
              {state.eraSkipsLeft}
            </Badge>
          </Button>
        </div>
      </div>

      {/* banned eras */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Banned eras
        </span>
        {state.excludedDecades.map((d) => (
          <Badge
            key={d}
            variant="outline"
            className={cn("font-mono line-through opacity-80", DECADE_COLORS[d].chip)}
          >
            {d}
          </Badge>
        ))}
      </div>

      {/* slot machine — team and era side by side */}
      <Card className="mt-3 shrink-0 gap-0 overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-accent/30 py-0">
        <div className="border-b border-border/60 px-4 py-1.5 text-center text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          Round {state.round} spin
        </div>
        <div className="flex items-stretch gap-2 px-3 py-3">
          <SlotReel
            value={franchiseName}
            items={franchiseNames}
            nonce={state.spinNonce}
            duration={FRANCHISE_REEL_S}
            idleLabel="? ? ?"
            className="flex-[1.6] rounded-lg bg-background/40"
            rowClassName="font-display text-lg tracking-wide text-center leading-tight px-1"
          />
          <SlotReel
            value={spin?.decade ?? null}
            items={decadeItems}
            nonce={state.spinNonce}
            duration={FRANCHISE_REEL_S - 0.2}
            delay={DECADE_REEL_DELAY_S}
            idleLabel="— — —"
            className="flex-1 rounded-lg bg-background/40"
            rowClassName={cn(
              "font-display text-2xl tracking-wider",
              spin ? DECADE_COLORS[spin.decade].text : "text-primary"
            )}
          />
        </div>
      </Card>

      {/* pool appears automatically once the reels settle */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
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
                  className="h-16 w-full rounded-2xl font-display text-2xl tracking-wide shadow-xl shadow-primary/30"
                  onClick={() => dispatch({ type: "SPIN" })}
                >
                  {state.picks.length === 0 ? "Spin the wheel" : "Spin next pick"}
                </Button>
              </motion.div>
            </motion.div>
          ) : spinning ? (
            <motion.p
              key="rolling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center font-display text-lg tracking-widest text-muted-foreground"
            >
              ROLLING…
            </motion.p>
          ) : (
            <motion.div
              key={`pool-${state.spinNonce}`}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex items-baseline gap-2 pb-1">
                <span className="font-display text-base">{franchiseName}</span>
                <span
                  className={cn(
                    "font-mono text-sm font-bold",
                    spin && DECADE_COLORS[spin.decade].text
                  )}
                >
                  {spin?.decade}
                </span>
              </div>
              <PoolList
                pool={pool}
                selectedId={state.selectedPlayerId}
                isDraftable={(id) => draftable.has(id)}
                onSelect={(playerId) => dispatch({ type: "SELECT_PLAYER", playerId })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the roster being built */}
      <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-background to-transparent pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <RosterBoard />
      </div>
    </div>
  );
}
