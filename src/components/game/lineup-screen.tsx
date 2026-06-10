"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BENCH_COUNT,
  POSITIONS,
  type PlayerStatLine,
  type Position,
} from "@/lib/contracts";
import { cn } from "@/lib/utils";
import {
  isOutOfPosition,
  lineupComplete,
  unassignedPicks,
  type AssignTarget,
} from "./draft-state";
import { useGame } from "./game-provider";
import { PlayerHeadshot } from "./player-headshot";
import { usePhaseGuard } from "./use-phase-guard";

function lastName(p: PlayerStatLine): string {
  return p.name.split(" ").slice(-1)[0];
}

function SlotButton({
  label,
  player,
  selected,
  warning,
  onTap,
}: {
  label: string;
  player: PlayerStatLine | null;
  selected: boolean;
  warning: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border bg-card/70 px-1 py-2 transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/60"
          : "border-border/60",
        !player && "border-dashed"
      )}
    >
      <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
        {label}
      </span>
      {player ? (
        <motion.div
          layout
          className="flex min-w-0 flex-col items-center gap-1"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          key={player.id}
        >
          <PlayerHeadshot player={player} className="size-10" />
          <span className="w-full max-w-full truncate text-center text-[10px] leading-none font-medium">
            {lastName(player)}
          </span>
        </motion.div>
      ) : (
        <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50">
          +
        </span>
      )}
      {warning && (
        <Badge
          variant="destructive"
          className="absolute -top-2 left-1/2 h-4 -translate-x-1/2 gap-0.5 px-1.5 text-[9px]"
        >
          <TriangleAlert className="size-2.5!" /> OOP
        </Badge>
      )}
    </button>
  );
}

function LineupSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

export function LineupScreen() {
  const { state, dispatch, players } = useGame();
  const allowed = usePhaseGuard(["lineup"]);
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!state || !allowed) return <LineupSkeleton />;

  const unassigned = unassignedPicks(state);
  const complete = lineupComplete(state);

  const get = (id: string | null): PlayerStatLine | null =>
    id ? (players.get(id) ?? null) : null;

  const tapSlot = (target: AssignTarget, occupantId: string | null) => {
    if (selectedId) {
      dispatch({ type: "ASSIGN", playerId: selectedId, target });
      setSelectedId(null);
    } else if (occupantId) {
      setSelectedId(occupantId);
    }
  };

  const tapUnassigned = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const lockIn = () => {
    dispatch({ type: "LOCK" });
    router.push("/sim");
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-4">
      <h1 className="text-lg font-bold">Set your lineup</h1>
      <p className="text-sm text-muted-foreground">
        {selectedId
          ? "Now tap a slot to place them — tap a filled slot to swap."
          : "Tap a player, then tap a slot. Tap a filled slot to pick them up."}
      </p>

      {/* unassigned tray */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Drafted ({unassigned.length} unplaced)
        </p>
        <div className="mt-2 flex min-h-[76px] gap-2 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-2">
          {unassigned.length === 0 ? (
            <span className="self-center px-2 text-sm text-muted-foreground">
              Everyone is placed.
            </span>
          ) : (
            unassigned.map((id) => {
              const p = players.get(id);
              if (!p) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => tapUnassigned(id)}
                  aria-pressed={selectedId === id}
                  className={cn(
                    "flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg border border-transparent p-1.5 transition-colors",
                    selectedId === id &&
                      "border-primary bg-primary/10 ring-2 ring-primary/60"
                  )}
                >
                  <PlayerHeadshot player={p} className="size-10" />
                  <span className="w-full truncate text-center text-[10px] leading-none">
                    {lastName(p)}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {[p.position, ...p.altPositions].join("/")}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* starters */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Starters
        </p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {POSITIONS.map((pos: Position) => {
            const occupantId = state.starters[pos];
            const player = get(occupantId);
            return (
              <SlotButton
                key={pos}
                label={pos}
                player={player}
                selected={selectedId !== null && selectedId === occupantId}
                warning={player !== null && isOutOfPosition(player, pos)}
                onTap={() =>
                  tapSlot({ kind: "starter", position: pos }, occupantId)
                }
              />
            );
          })}
        </div>
      </div>

      {/* bench */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Bench
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {Array.from({ length: BENCH_COUNT }, (_, i) => {
            const occupantId = state.bench[i];
            const player = get(occupantId);
            return (
              <SlotButton
                key={i}
                label={`B${i + 1}`}
                player={player}
                selected={selectedId !== null && selectedId === occupantId}
                warning={false}
                onTap={() => tapSlot({ kind: "bench", index: i }, occupantId)}
              />
            );
          })}
        </div>
      </div>

      {POSITIONS.some((pos) => {
        const p = get(state.starters[pos]);
        return p && isOutOfPosition(p, pos);
      }) && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          Out-of-position starters are allowed, but the engine docks them.
        </p>
      )}

      {/* thumb-zone footer */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          className="h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
          disabled={!complete}
          onClick={lockIn}
        >
          {complete
            ? "Lock in & Simulate"
            : `Assign ${unassigned.length} more to lock in`}
        </Button>
      </div>
    </div>
  );
}
