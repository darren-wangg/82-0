"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { NineCat, PlayerStatLine } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { formatCatValue, isEstimated, SORT_OPTIONS } from "./format";
import { PlayerHeadshot } from "./player-headshot";

function StatChip({
  player,
  cat,
  label,
  emphasized,
}: {
  player: PlayerStatLine;
  cat: NineCat;
  label: string;
  emphasized: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] tabular-nums",
        emphasized ? "font-bold text-primary" : "text-muted-foreground"
      )}
    >
      {formatCatValue(cat, player.stats[cat])}
      {isEstimated(player, cat) && <span className="opacity-60">*</span>}{" "}
      <span className="text-[9px] font-semibold opacity-70">{label}</span>
    </span>
  );
}

/**
 * The post-spin player pool: appears automatically once the reels settle,
 * sorted by the chosen stat (PPG by default). One tap selects a player and
 * lights up their eligible roster slots — placement happens on the board.
 * Players with no open eligible slot are shown dimmed.
 */
export function PoolList({
  pool,
  selectedId,
  isDraftable,
  onSelect,
}: {
  pool: PlayerStatLine[];
  selectedId: string | null;
  isDraftable: (id: string) => boolean;
  onSelect: (id: string | null) => void;
}) {
  const [sortCat, setSortCat] = useState<NineCat>("pts");

  const sorted = useMemo(
    () => [...pool].sort((a, b) => b.stats[sortCat] - a.stats[sortCat]),
    [pool, sortCat]
  );

  // Always show PPG/RPG/APG; when sorting by another cat, swap it in front.
  const shownCats = useMemo(() => {
    const base: { cat: NineCat; label: string }[] = [
      { cat: "pts", label: "PPG" },
      { cat: "reb", label: "RPG" },
      { cat: "ast", label: "APG" },
    ];
    if (base.some((b) => b.cat === sortCat)) return base;
    const extra = SORT_OPTIONS.find((o) => o.cat === sortCat)!;
    return [extra, ...base.slice(0, 2)];
  }, [sortCat]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center justify-between pb-1.5">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Tap a player, then a glowing slot
        </p>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          Sort
          <select
            value={sortCat}
            onChange={(e) => setSortCat(e.target.value as NineCat)}
            className="h-8 rounded-lg border border-border bg-card px-2 font-mono text-xs font-bold text-foreground"
            aria-label="Sort players by stat"
          >
            {SORT_OPTIONS.map(({ cat, label }) => (
              <option key={cat} value={cat}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-2">
        {sorted.map((p, i) => {
          const draftable = isDraftable(p.id);
          const selected = selectedId === p.id;
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.035, 0.45), duration: 0.25 }}
            >
              <button
                type="button"
                disabled={!draftable}
                onClick={() => onSelect(selected ? null : p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/15 shadow-md shadow-primary/20"
                    : "border-border/60 bg-card/70",
                  draftable
                    ? "active:scale-[0.99]"
                    : "opacity-40 grayscale"
                )}
              >
                <PlayerHeadshot player={p} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{p.name}</span>
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 px-1 font-mono text-[9px]"
                    >
                      {[p.position, ...p.altPositions].join("/")}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2.5">
                    {shownCats.map(({ cat, label }) => (
                      <StatChip
                        key={cat}
                        player={p}
                        cat={cat}
                        label={label}
                        emphasized={cat === sortCat}
                      />
                    ))}
                  </div>
                </div>
                <span className="shrink-0 pr-1 font-mono text-[10px] text-muted-foreground">
                  {p.peakSeason}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
