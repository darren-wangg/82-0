"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCcw, RotateCcw, Users } from "lucide-react";
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
import { ChallengeBanner } from "./challenge-banner";
import { DECADE_COLORS } from "./format";
import { freshSeed, useGame } from "./game-provider";
import { PoolList, useStatsToggle } from "./pool-list";
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
  const rounds = ctx.mode?.draftRounds ?? DRAFT_ROUNDS;
  const { showStats, toggleStats } = useStatsToggle();

  // Arriving via /play?challenge={slug} retargets the draft at that team;
  // /play?lobby={code} starts a draft destined for that lobby. A fresh (or
  // already-matching) game adopts it silently; an in-progress draft asks
  // before being scrapped.
  const searchParams = useSearchParams();
  const challengeParam = searchParams.get("challenge");
  const lobbyParam = searchParams.get("lobby");
  const stateChallenge = state?.challengeSlug ?? null;
  const stateLobby = state?.lobbyCode ?? null;
  const statePicks = state?.picks.length ?? 0;
  const stateReady = state !== null;
  useEffect(() => {
    if (!stateReady) return;
    const wantsChallenge = challengeParam && challengeParam !== stateChallenge;
    const wantsLobby = lobbyParam && lobbyParam !== stateLobby;
    if (!wantsChallenge && !wantsLobby) return;
    if (
      statePicks > 0 &&
      !window.confirm(
        `Start a ${wantsLobby ? "lobby" : "challenge"} draft? Your current draft will be scrapped.`
      )
    ) {
      return;
    }
    dispatch({
      type: "NEW_GAME",
      seed: freshSeed(),
      challengeSlug: wantsChallenge ? challengeParam : null,
      lobbyCode: wantsLobby ? lobbyParam : null,
    });
  }, [stateReady, challengeParam, stateChallenge, lobbyParam, stateLobby, statePicks, dispatch]);

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
              {/* keyed by round so each pick pops the counter */}
              <motion.span
                key={state.picks.length}
                initial={{ scale: 1.5, color: "var(--primary)" }}
                animate={{ scale: 1, color: "var(--foreground)" }}
                transition={{ type: "spring", stiffness: 400, damping: 16 }}
                className="inline-block font-mono tabular-nums"
              >
                {Math.min(state.picks.length + 1, rounds)} of {rounds}
              </motion.span>
            </p>
            {/* Lobby drafts are one-shot — no restarting into a fresh pool. */}
            {!state.lobbyCode && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New draft"
                className="text-muted-foreground"
                onClick={newGame}
              >
                <RotateCcw />
              </Button>
            )}
          </div>
          <Progress
            value={(state.picks.length / rounds) * 100}
            className="mt-1 w-28"
            aria-label="Draft progress"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={!showStats}
            className={cn(
              "h-9 rounded-lg px-2 text-xs font-semibold transition-colors",
              showStats ? "text-muted-foreground" : "text-primary"
            )}
            onClick={toggleStats}
          >
            {showStats ? "Hide Stats" : "Show Stats"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-red-500/60 px-3 font-bold text-red-400 shadow-md shadow-red-950/50 transition-transform active:scale-95 disabled:opacity-35 disabled:grayscale"
            disabled={!skipTeamOk}
            onClick={() => dispatch({ type: "SKIP_TEAM" })}
          >
            Team <RefreshCcw className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-orange-500/60 px-3 font-bold text-orange-400 shadow-md shadow-orange-950/50 transition-transform active:scale-95 disabled:opacity-35 disabled:grayscale"
            disabled={!skipEraOk}
            onClick={() => dispatch({ type: "SKIP_ERA" })}
          >
            Era <RefreshCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {state.challengeSlug && <ChallengeBanner slug={state.challengeSlug} />}
      {state.lobbyCode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1.5 text-xs"
        >
          <Users className="size-3.5 shrink-0 text-sky-300" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              Lobby draft —{" "}
              <span className="font-mono font-bold tracking-widest text-sky-300">
                {state.lobbyCode}
              </span>
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline"
            onClick={() => {
              if (
                window.confirm(
                  `Leave lobby ${state.lobbyCode}? This draft continues as free play; to enter the lobby later you'll need its link and a fresh draft.`
                )
              ) {
                dispatch({ type: "LEAVE_LOBBY" });
              }
            }}
          >
            Leave
          </button>
        </motion.div>
      )}

      {/* slot machine — team and era cards side by side */}
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
            // The era box takes on the decade's color identity once it lands.
            settled && spin ? DECADE_COLORS[spin.decade].ring : "ring-orange-500/50"
          )}
          rowClassName={cn(
            "font-display text-2xl tracking-wider",
            spin ? DECADE_COLORS[spin.decade].text : "text-primary"
          )}
        />
      </div>

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
                  className="h-16 w-full rounded-2xl bg-gradient-to-r from-primary via-orange-400 to-primary bg-[length:200%_100%] bg-left font-display text-2xl tracking-wide shadow-xl shadow-primary/30 transition-[transform,background-position] duration-500 hover:bg-right active:scale-95"
                  onClick={() => dispatch({ type: "SPIN" })}
                >
                  Spin
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
              {"SPINNING…".split("").map((ch, i) => (
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
                isDraftable={(id) => draftable.has(id)}
                onSelect={(playerId) => dispatch({ type: "SELECT_PLAYER", playerId })}
                showStats={showStats}
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
