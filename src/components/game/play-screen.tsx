"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCcw, RotateCcw } from "lucide-react";
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
import { ChallengeBanner } from "./challenge-banner";
import { DECADE_COLORS } from "./format";
import { freshSeed, useGame } from "./game-provider";
import { PoolList } from "./pool-list";
import { RosterBoard } from "./roster-board";
import { SlotReel } from "./slot-reel";
import { usePhaseGuard } from "./use-phase-guard";

/** Reel roll time (franchise reel + staggered decade reel), in ms. */
const REEL_MS = 3900;
const FRANCHISE_REEL_S = 3.0;
const DECADE_REEL_DELAY_S = 0.6;

/** Idle-reel placeholders shown before the first spin of a round. */
const PLACEHOLDER_TEAM = "Chicago Bulls";
const PLACEHOLDER_ERA = "1990s";

function PlaySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-28 w-full rounded-xl" />
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

  // Arriving via /play?challenge={slug} retargets the draft at that team.
  // A fresh (or already-matching) game adopts it silently; an in-progress
  // draft asks before being scrapped.
  const challengeParam = useSearchParams().get("challenge");
  const stateChallenge = state?.challengeSlug ?? null;
  const statePicks = state?.picks.length ?? 0;
  const stateReady = state !== null;
  useEffect(() => {
    if (!stateReady || !challengeParam || challengeParam === stateChallenge) {
      return;
    }
    if (
      statePicks > 0 &&
      !window.confirm("Start a challenge draft? Your current draft will be scrapped.")
    ) {
      return;
    }
    dispatch({ type: "NEW_GAME", seed: freshSeed(), challengeSlug: challengeParam });
  }, [stateReady, challengeParam, stateChallenge, statePicks, dispatch]);

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
    <div className="flex h-dvh flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
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
            className="h-9 rounded-lg border-red-500/60 px-3 font-bold text-red-400 shadow-md shadow-red-950/50 disabled:opacity-35 disabled:grayscale"
            disabled={!skipTeamOk}
            onClick={() => dispatch({ type: "SKIP_TEAM" })}
          >
            <RefreshCcw className="size-3.5" /> Team
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-orange-500/60 px-3 font-bold text-orange-400 shadow-md shadow-orange-950/50 disabled:opacity-35 disabled:grayscale"
            disabled={!skipEraOk}
            onClick={() => dispatch({ type: "SKIP_ERA" })}
          >
            <RefreshCcw className="size-3.5" /> Era
          </Button>
        </div>
      </div>

      {state.challengeSlug && <ChallengeBanner slug={state.challengeSlug} />}

      {/* slot machine — team and era side by side */}
      <Card className="mt-3 shrink-0 gap-0 overflow-hidden border border-primary/40 bg-gradient-to-br from-card via-card to-accent/30 py-0 shadow-xl shadow-black/50">
        <div className="flex gap-2 px-3 pt-2.5">
          <span className="flex-[1.6] text-center font-display text-[11px] tracking-[0.3em] text-red-400">
            TEAM
          </span>
          <span className="flex-1 text-center font-display text-[11px] tracking-[0.3em] text-orange-400">
            ERA
          </span>
        </div>
        <div className="flex items-stretch gap-2 px-3 pt-1.5 pb-3">
          <SlotReel
            value={franchiseName}
            items={franchiseNames}
            nonce={state.spinNonce}
            duration={FRANCHISE_REEL_S}
            idleLabel={PLACEHOLDER_TEAM}
            className="flex-[1.6] rounded-lg bg-background/40 ring-1 ring-red-500/30"
            rowClassName="font-display text-lg tracking-wide text-center leading-tight px-1"
          />
          <SlotReel
            value={spin?.decade ?? null}
            items={[...DECADES]}
            nonce={state.spinNonce}
            duration={FRANCHISE_REEL_S - 0.2}
            delay={DECADE_REEL_DELAY_S}
            idleLabel={PLACEHOLDER_ERA}
            className="flex-1 rounded-lg bg-background/40 ring-1 ring-orange-500/30"
            rowClassName={cn(
              "font-display text-2xl tracking-wider",
              spin ? DECADE_COLORS[spin.decade].text : "text-primary"
            )}
          />
        </div>
      </Card>

      {/* pool appears automatically once the reels settle */}
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
                  className="h-16 w-full rounded-2xl font-display text-2xl tracking-wide shadow-xl shadow-primary/30"
                  onClick={() => dispatch({ type: "SPIN" })}
                >
                  Spin
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
