"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { POSITIONS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import {
  BENCH_SLOTS,
  eligibleSlotsFor,
  moveTargetsFor,
  SLOT_LABELS,
  type Slot,
} from "./draft-state";
import { teamAverages } from "./format";
import { useGame } from "./game-provider";
import { PlayerHeadshot } from "./player-headshot";

function SlotCircle({
  slot,
  highlighted,
  moveSource,
  replaceTarget,
  onTap,
  small,
}: {
  slot: Slot;
  /** Pulsing target: placement (pool pick) or move destination. */
  highlighted: boolean;
  /** This filled slot is currently selected for moving. */
  moveSource: boolean;
  /** Replace mode: tapping this filled slot evicts its player. */
  replaceTarget: boolean;
  onTap: (slot: Slot) => void;
  small?: boolean;
}) {
  const { state, players } = useGame();
  const id = state?.slots[slot] ?? null;
  const player = id ? players.get(id) : undefined;
  // Sized so 5 starters + divider + 3 bench fit a 375px viewport without
  // the circles (and their rings) overlapping.
  const size = small ? "size-9" : "size-10";

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      {player ? (
        <motion.button
          type="button"
          aria-label={`${player.name} at ${SLOT_LABELS[slot]}${replaceTarget ? " — tap to replace" : highlighted ? " — tap to swap here" : moveSource ? " — selected" : " — tap to move"}`}
          onClick={() => onTap(slot)}
          initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
          animate={
            highlighted || replaceTarget
              ? { scale: [1, 1.1, 1], opacity: 1, rotate: 0 }
              : { scale: 1, opacity: 1, rotate: 0 }
          }
          transition={
            highlighted || replaceTarget
              ? { repeat: Infinity, duration: 1.1 }
              : { type: "spring", stiffness: 380, damping: 20 }
          }
          className={cn(
            "rounded-full ring-2 ring-offset-1 ring-offset-background",
            size,
            replaceTarget
              ? "ring-rose-500 shadow-lg shadow-rose-500/40"
              : moveSource
                ? "ring-sky-400 shadow-lg shadow-sky-400/40"
                : highlighted
                  ? "ring-primary shadow-lg shadow-primary/40"
                  : "ring-primary/40"
          )}
        >
          <PlayerHeadshot player={player} className="size-full" />
        </motion.button>
      ) : (
        <motion.button
          type="button"
          aria-label={`Place player at ${SLOT_LABELS[slot]}`}
          disabled={!highlighted}
          onClick={() => onTap(slot)}
          animate={highlighted ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={
            highlighted ? { repeat: Infinity, duration: 1.1 } : { duration: 0.15 }
          }
          className={cn(
            "flex items-center justify-center rounded-full border-2 border-dashed font-display text-sm",
            size,
            highlighted
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
          highlighted && !player ? "font-bold text-primary" : "text-muted-foreground"
        )}
      >
        {player ? player.name.split(" ").slice(-1)[0] : SLOT_LABELS[slot]}
      </span>
    </div>
  );
}

/**
 * The live roster: 5 starter slots + 3 bench slots (G/F/C).
 *
 * Three interactions:
 *  - Placement: while a pool player is selected, their eligible open slots
 *    pulse; tapping one drafts them into it.
 *  - Rearranging: with no pool selection, tapping a filled slot selects it
 *    (blue ring) and pulses every slot that player can move to — empty ones,
 *    or filled ones where the two players can legally swap.
 *  - Replace (once per game, armed by the header toggle via `replaceMode`):
 *    every filled slot pulses; tapping one cuts that player so a fresh spin
 *    can re-fill the slot.
 *
 * Shows only basic team per-game averages; the full engine breakdown stays
 * hidden until the season simulates.
 */
export function RosterBoard({
  className,
  replaceMode = false,
  onReplaceDone,
}: {
  className?: string;
  replaceMode?: boolean;
  onReplaceDone?: () => void;
}) {
  const { state, dispatch, ctx, players } = useGame();
  const [moveFrom, setMoveFrom] = useState<Slot | null>(null);

  const placing = state?.selectedPlayerId ?? null;
  // A new pool selection cancels any in-progress move (state adjusted during
  // render, per the React "derived reset" pattern).
  const [prevPlacing, setPrevPlacing] = useState(placing);
  if (placing !== prevPlacing) {
    setPrevPlacing(placing);
    if (placing) setMoveFrom(null);
  }
  // Arming replace mode likewise drops any half-finished move.
  const [prevReplace, setPrevReplace] = useState(replaceMode);
  if (replaceMode !== prevReplace) {
    setPrevReplace(replaceMode);
    if (replaceMode) setMoveFrom(null);
  }

  if (!state) return null;

  const highlights = new Set<Slot>(
    placing
      ? eligibleSlotsFor(placing, state, ctx)
      : moveFrom
        ? moveTargetsFor(moveFrom, state, ctx)
        : []
  );
  const onTap = (slot: Slot) => {
    if (replaceMode) {
      if (state.slots[slot]) {
        dispatch({ type: "REPLACE", slot });
        onReplaceDone?.();
      }
      return;
    }
    if (placing) {
      if (highlights.has(slot)) dispatch({ type: "PLACE", slot });
      return;
    }
    if (moveFrom) {
      if (highlights.has(slot)) {
        dispatch({ type: "MOVE", from: moveFrom, to: slot });
        setMoveFrom(null);
        return;
      }
      // Tapping the source (or anything else filled) re-targets / deselects.
      setMoveFrom(slot === moveFrom ? null : state.slots[slot] ? slot : null);
      return;
    }
    if (state.slots[slot]) setMoveFrom(slot);
  };

  const drafted = state.picks.flatMap((id) => players.get(id) ?? []);
  const avgs = teamAverages(drafted);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <AnimatePresence>
        {replaceMode && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-center text-[10px] font-semibold text-rose-400"
          >
            Tap a player to cut them, then spin for the replacement
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-1">
        {POSITIONS.map((p) => (
          <SlotCircle
            key={p}
            slot={p}
            highlighted={highlights.has(p)}
            moveSource={moveFrom === p}
            replaceTarget={replaceMode && state.slots[p] !== null}
            onTap={onTap}
          />
        ))}
        <div className="mx-0.5 h-10 w-px shrink-0 self-center bg-border" />
        {BENCH_SLOTS.map((s) => (
          <SlotCircle
            key={s}
            slot={s}
            highlighted={highlights.has(s)}
            moveSource={moveFrom === s}
            replaceTarget={replaceMode && state.slots[s] !== null}
            onTap={onTap}
            small
          />
        ))}
      </div>
      <div
        className="flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5"
        aria-label="Team per-game averages"
      >
        {avgs.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center">
            {/* keyed by value so every draft pick pops the number */}
            <motion.span
              key={value}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="font-mono text-[11px] font-bold tabular-nums"
            >
              {value}
            </motion.span>
            <span className="text-[8px] font-semibold tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
