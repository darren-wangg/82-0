"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DECADES, DRAFT_ROUNDS } from "@/lib/contracts";
import {
  canSkipEra,
  canSkipTeam,
  pickablePool,
} from "./draft-state";
import { freshSeed, useGame } from "./game-provider";
import { PoolDrawer } from "./pool-drawer";
import { RosterStrip } from "./roster-strip";
import { SlotReel } from "./slot-reel";
import { usePhaseGuard } from "./use-phase-guard";

/** Reel roll time (franchise reel + staggered decade reel), in ms. */
const REEL_MS = 1650;

function PlaySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-11 w-full" />
      <div className="mt-auto flex flex-col gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function PlayScreen() {
  const { state, dispatch, ctx, players, franchiseById } = useGame();
  const allowed = usePhaseGuard(["draft"]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // Nonce of the last spin whose reel animation has finished. Every (re)spin —
  // including a restored pending spin on mount — counts as a reel roll: the
  // CTA and skips unlock only once the reel settles.
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
    () =>
      Object.keys(ctx.pools).map(
        (id) => franchiseById.get(id)?.name ?? id
      ),
    [ctx, franchiseById]
  );

  if (!state || !allowed) return <PlaySkeleton />;

  const spin = state.spin;
  const decadeItems = DECADES.filter(
    (d) => !state.excludedDecades.includes(d)
  );
  const poolIds = spin
    ? pickablePool(state, ctx, spin.franchiseId, spin.decade)
    : [];
  const pool = poolIds.flatMap((id) => players.get(id) ?? []);
  const franchiseName = spin
    ? (franchiseById.get(spin.franchiseId)?.name ?? spin.franchiseId)
    : null;

  const settled = spin !== null && !spinning;
  const skipTeamOk = settled && canSkipTeam(state, ctx);
  const skipEraOk = settled && canSkipEra(state, ctx);

  const newGame = () => {
    if (state.picks.length > 0 && !window.confirm("Scrap this draft and start over?")) {
      return;
    }
    setDrawerOpen(false);
    dispatch({ type: "NEW_GAME", seed: freshSeed() });
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-4">
      {/* progress */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Pick{" "}
          <span className="font-mono tabular-nums">
            {Math.min(state.picks.length + 1, DRAFT_ROUNDS)} of {DRAFT_ROUNDS}
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          onClick={newGame}
        >
          <RotateCcw data-icon="inline-start" /> New draft
        </Button>
      </div>
      <Progress
        value={(state.picks.length / DRAFT_ROUNDS) * 100}
        className="mt-1"
        aria-label="Draft progress"
      />

      {/* excluded decades */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Banned eras
        </span>
        {state.excludedDecades.map((d) => (
          <Badge key={d} variant="destructive" className="font-mono line-through">
            {d}
          </Badge>
        ))}
      </div>

      {/* slot machine */}
      <Card className="mt-4 gap-0 overflow-hidden border-border/60 bg-card/80 py-0">
        <div className="border-b border-border/60 px-4 py-2 text-center text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          Round {state.round} spin
        </div>
        <div className="flex flex-col gap-1 px-4 py-4">
          <SlotReel
            value={franchiseName}
            items={franchiseNames}
            nonce={state.spinNonce}
            idleLabel="? ? ?"
            rowClassName="text-2xl font-black tracking-tight text-center leading-tight"
          />
          <SlotReel
            value={spin?.decade ?? null}
            items={decadeItems}
            nonce={state.spinNonce}
            delay={0.18}
            idleLabel="— — —"
            rowClassName="font-mono text-lg font-bold text-primary"
          />
        </div>
      </Card>

      {/* skips */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          disabled={!skipTeamOk}
          onClick={() => dispatch({ type: "SKIP_TEAM" })}
        >
          Skip team
          <Badge variant="secondary" className="font-mono">
            {state.teamSkipsLeft}
          </Badge>
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          disabled={!skipEraOk}
          onClick={() => dispatch({ type: "SKIP_ERA" })}
        >
          Skip era
          <Badge variant="secondary" className="font-mono">
            {state.eraSkipsLeft}
          </Badge>
        </Button>
      </div>

      {/* thumb-zone footer */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-3 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <RosterStrip />
        {spin === null ? (
          <Button
            className="h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
            onClick={() => dispatch({ type: "SPIN" })}
          >
            Spin
          </Button>
        ) : (
          <Button
            className="h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
            disabled={!settled}
            onClick={() => setDrawerOpen(true)}
          >
            {spinning ? "Spinning…" : `View players (${pool.length})`}
          </Button>
        )}
      </div>

      <PoolDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={spin ? `${franchiseName} · ${spin.decade}` : ""}
        description={`Draft one player for roster spot ${Math.min(
          state.picks.length + 1,
          DRAFT_ROUNDS
        )} of ${DRAFT_ROUNDS}`}
        pool={pool}
        onPick={(playerId) => dispatch({ type: "PICK", playerId })}
      />
    </div>
  );
}
