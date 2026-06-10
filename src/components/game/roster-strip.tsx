"use client";

import { motion } from "framer-motion";
import { DRAFT_ROUNDS } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "./player-headshot";
import { useGame } from "./game-provider";

/** Persistent strip of the 8 roster slots filling up as the draft goes. */
export function RosterStrip({ className }: { className?: string }) {
  const { state, players } = useGame();
  if (!state) return null;

  return (
    <div
      className={cn("flex items-center justify-between gap-1", className)}
      aria-label={`Roster: ${state.picks.length} of ${DRAFT_ROUNDS} drafted`}
    >
      {Array.from({ length: DRAFT_ROUNDS }, (_, i) => {
        const id = state.picks[i];
        const player = id ? players.get(id) : undefined;
        const isCurrent = state.status === "draft" && i === state.picks.length;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {player ? (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
                <PlayerHeadshot player={player} className="size-9" />
              </motion.div>
            ) : (
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-xs font-bold text-muted-foreground/50",
                  isCurrent && "animate-pulse border-primary/60 text-primary"
                )}
              >
                {i + 1}
              </div>
            )}
            <span className="w-full truncate text-center text-[9px] leading-none text-muted-foreground">
              {player ? player.name.split(" ").slice(-1)[0] : " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}
