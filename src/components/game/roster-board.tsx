"use client";

import { motion } from "framer-motion";
import { POSITIONS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import {
  BENCH_SLOTS,
  eligibleSlotsFor,
  SLOT_LABELS,
  type Slot,
} from "./draft-state";
import { teamAverages } from "./format";
import { useGame } from "./game-provider";
import { PlayerHeadshot } from "./player-headshot";

function SlotCircle({
  slot,
  eligible,
  small,
}: {
  slot: Slot;
  eligible: boolean;
  small?: boolean;
}) {
  const { state, dispatch, players } = useGame();
  const id = state?.slots[slot] ?? null;
  const player = id ? players.get(id) : undefined;
  const size = small ? "size-12" : "size-14";

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      {player ? (
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          className={cn(
            "rounded-full ring-2 ring-primary/70 ring-offset-2 ring-offset-background",
            size
          )}
        >
          <PlayerHeadshot player={player} className="size-full" />
        </motion.div>
      ) : (
        <motion.button
          type="button"
          aria-label={`Place player at ${SLOT_LABELS[slot]}`}
          disabled={!eligible}
          onClick={() => dispatch({ type: "PLACE", slot })}
          animate={
            eligible
              ? { scale: [1, 1.12, 1], opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            eligible ? { repeat: Infinity, duration: 1.1 } : { duration: 0.15 }
          }
          className={cn(
            "flex items-center justify-center rounded-full border-2 border-dashed font-display text-sm",
            size,
            eligible
              ? "cursor-pointer border-primary bg-primary/20 text-primary shadow-lg shadow-primary/30"
              : "border-muted-foreground/25 text-muted-foreground/40"
          )}
        >
          {SLOT_LABELS[slot]}
        </motion.button>
      )}
      <span
        className={cn(
          "w-full truncate text-center text-[9px] leading-none",
          eligible && !player ? "font-bold text-primary" : "text-muted-foreground"
        )}
      >
        {player ? player.name.split(" ").slice(-1)[0] : SLOT_LABELS[slot]}
      </span>
    </div>
  );
}

/**
 * The live roster: 5 starter slots + 3 bench slots (G/F/C). While a pool
 * player is selected, their eligible open slots pulse — tapping one drafts
 * the player into it. Shows only basic team per-game averages; the full
 * engine breakdown stays hidden until the season simulates.
 */
export function RosterBoard({ className }: { className?: string }) {
  const { state, ctx, players } = useGame();
  if (!state) return null;

  const eligible = new Set<Slot>(
    state.selectedPlayerId
      ? eligibleSlotsFor(state.selectedPlayerId, state, ctx)
      : []
  );
  const drafted = state.picks.flatMap((id) => players.get(id) ?? []);
  const avgs = teamAverages(drafted);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end gap-1.5">
        {POSITIONS.map((p) => (
          <SlotCircle key={p} slot={p} eligible={eligible.has(p)} />
        ))}
        <div className="mx-0.5 h-12 w-px shrink-0 self-center bg-border" />
        {BENCH_SLOTS.map((s) => (
          <SlotCircle key={s} slot={s} eligible={eligible.has(s)} small />
        ))}
      </div>
      <div
        className="flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5"
        aria-label="Team per-game averages"
      >
        {avgs.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center">
            <span className="font-mono text-[11px] font-bold tabular-nums">
              {value}
            </span>
            <span className="text-[8px] font-semibold tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
