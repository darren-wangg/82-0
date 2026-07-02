"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";
import { POSITIONS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import {
  eligibleSlotsFor,
  moveTargetsFor,
  SLOT_LABELS,
  type Slot,
} from "./draft-state";
import { ONE_DECIMAL, teamAverages } from "./format";
import { useGame } from "./game-provider";
import { PlayerHeadshot } from "./player-headshot";

function SlotCircle({
  slot,
  highlighted,
  moveSource,
  onTap,
  size = "size-10",
}: {
  slot: Slot;
  /** Pulsing target: placement (pool pick) or move destination. */
  highlighted: boolean;
  /** This filled slot is currently selected for moving. */
  moveSource: boolean;
  onTap: (slot: Slot) => void;
  /** Circle size class — shrunk so 10 slots still fit a 375px viewport. */
  size?: string;
}) {
  const t = useTranslations("roster");
  const { state, players } = useGame();
  const id = state?.slots[slot] ?? null;
  const player = id ? players.get(id) : undefined;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      {player ? (
        <motion.button
          type="button"
          aria-label={`${t("slotFilled", { name: player.name, slot: SLOT_LABELS[slot] })} — ${
            highlighted
              ? t("actionSwap")
              : moveSource
                ? t("actionSelected")
                : t("actionMove")
          }`}
          onClick={() => onTap(slot)}
          initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
          animate={
            highlighted
              ? { scale: [1, 1.1, 1], opacity: 1, rotate: 0 }
              : { scale: 1, opacity: 1, rotate: 0 }
          }
          transition={
            highlighted
              ? { repeat: Infinity, duration: 1.1 }
              : { type: "spring", stiffness: 380, damping: 20 }
          }
          className={cn(
            "rounded-full ring-2 ring-offset-1 ring-offset-background",
            size,
            moveSource
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
          aria-label={t("placeAt", { slot: SLOT_LABELS[slot] })}
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
 * Two interactions:
 *  - Placement: while a pool player is selected, their eligible open slots
 *    pulse; tapping one drafts them into it.
 *  - Rearranging: with no pool selection, tapping a filled slot selects it
 *    (blue ring) and pulses every slot that player can move to — empty ones,
 *    or filled ones where the two players can legally swap.
 *
 * Shows only basic team per-game averages; the full engine breakdown stays
 * hidden until the season simulates.
 */
export function RosterBoard({ className }: { className?: string }) {
  const t = useTranslations("roster");
  const format = useFormatter();
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

  if (!state) return null;

  const highlights = new Set<Slot>(
    placing
      ? eligibleSlotsFor(placing, state, ctx)
      : moveFrom
        ? moveTargetsFor(moveFrom, state, ctx)
        : []
  );
  const onTap = (slot: Slot) => {
    if (placing) {
      if (highlights.has(slot)) {
        haptic("medium");
        dispatch({ type: "PLACE", slot });
      }
      return;
    }
    if (moveFrom) {
      if (highlights.has(slot)) {
        haptic("light");
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

  const benchSlots = ctx.mode?.benchSlots ?? [];
  // 5 starters + a 3-slot bench fits at the default size; the 10-player
  // 10-man's 5-slot bench needs tighter circles to stay on one row.
  const compact = benchSlots.length > 3;
  const starterSize = compact ? "size-9" : "size-10";
  const benchSize = compact ? "size-8" : "size-9";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end gap-1">
        {POSITIONS.map((p) => (
          <SlotCircle
            key={p}
            slot={p}
            highlighted={highlights.has(p)}
            moveSource={moveFrom === p}
            onTap={onTap}
            size={starterSize}
          />
        ))}
        {/* No bench divider in 5-man (starters only). */}
        {benchSlots.length > 0 && (
          <div className="mx-0.5 h-10 w-px shrink-0 self-center bg-border" />
        )}
        {benchSlots.map(({ key }) => (
          <SlotCircle
            key={key}
            slot={key}
            highlighted={highlights.has(key)}
            moveSource={moveFrom === key}
            onTap={onTap}
            size={benchSize}
          />
        ))}
      </div>
      <div
        className="flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5"
        aria-label={t("averagesAria")}
      >
        {avgs.map(({ label, value }) => {
          const display = value === null ? "—" : format.number(value, ONE_DECIMAL);
          return (
          <div key={label} className="flex flex-col items-center">
            {/* keyed by value so every draft pick pops the number */}
            <motion.span
              key={display}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="font-mono text-[11px] font-bold tabular-nums"
            >
              {display}
            </motion.span>
            <span className="text-[8px] font-semibold tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
