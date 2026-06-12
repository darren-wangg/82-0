"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NineCat, PlayerStatLine } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { isEstimated, SORT_OPTIONS } from "./format";
import { isLegendary } from "./legends";
import { PlayerHeadshot } from "./player-headshot";

/** Lowercase + strip diacritics so search ignores both. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** The six per-game columns shown for every pool player. */
const ROW_CATS: { cat: NineCat; label: string }[] = [
  { cat: "pts", label: "PPG" },
  { cat: "reb", label: "RPG" },
  { cat: "ast", label: "APG" },
  { cat: "stl", label: "STL" },
  { cat: "blk", label: "BLK" },
  { cat: "tov", label: "TO" },
];

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
  const [query, setQuery] = useState("");
  const [showStats, setShowStats] = useState(true);

  const sorted = useMemo(() => {
    // Diacritic-insensitive ("jokic" finds Jokić) prefix-anywhere match.
    const q = normalize(query.trim());
    const matches = q
      ? pool.filter((p) => normalize(p.name).includes(q))
      : pool;
    return [...matches].sort((a, b) => b.stats[sortCat] - a.stats[sortCat]);
  }, [pool, sortCat, query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-1.5 pb-1.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search players by name"
          className="h-8 w-32 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          aria-label={showStats ? "Hide player stats" : "Show player stats"}
          aria-pressed={showStats}
          onClick={() => setShowStats((s) => !s)}
          className={cn(
            "ml-auto flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2 transition-colors",
            showStats ? "text-primary" : "text-muted-foreground/60"
          )}
        >
          <BarChart3 className="size-4" />
        </button>
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
      </div>

      {sorted.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No players match &ldquo;{query.trim()}&rdquo;
        </p>
      )}
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-2">
        {sorted.map((p, i) => {
          const draftable = isDraftable(p.id);
          const selected = selectedId === p.id;
          const legendary = isLegendary(p);
          const delay = Math.min(i * 0.035, 0.45);
          return (
            <motion.li
              key={p.id}
              // Legendary pulls get a delayed, springy "jackpot" reveal.
              initial={legendary ? { opacity: 0, scale: 0.9 } : { opacity: 0, x: -14 }}
              animate={legendary ? { opacity: 1, scale: 1 } : { opacity: 1, x: 0 }}
              transition={
                legendary
                  ? { delay: delay + 0.45, type: "spring", stiffness: 320, damping: 17 }
                  : { delay, duration: 0.25 }
              }
            >
              <button
                type="button"
                disabled={!draftable}
                onClick={() => onSelect(selected ? null : p.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/15 shadow-lg shadow-primary/25"
                    : legendary
                      ? "border-amber-400/60 bg-amber-400/10 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30"
                      : "border-border/80 bg-card/70 shadow-md shadow-black/25",
                  draftable ? "active:scale-[0.99]" : "opacity-40 grayscale"
                )}
              >
                <PlayerHeadshot player={p} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm font-bold",
                        legendary && "text-amber-200"
                      )}
                    >
                      {p.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 px-1 font-mono text-[9px]"
                      title={[p.position, ...p.altPositions].join("/")}
                    >
                      {/* Cap at 3 so true multi-position guys don't crowd out the name. */}
                      {[p.position, ...p.altPositions].slice(0, 3).join("/")}
                      {p.altPositions.length > 2 && "+"}
                    </Badge>
                  </div>
                  {showStats && (
                  <div className="mt-1 grid grid-cols-6 gap-1">
                    {ROW_CATS.map(({ cat, label }) => (
                      <div key={cat} className="flex flex-col items-start">
                        <span
                          className={cn(
                            "font-mono text-[11px] leading-none font-bold tabular-nums",
                            cat === sortCat ? "text-primary" : "text-foreground/90"
                          )}
                        >
                          {p.stats[cat].toFixed(1)}
                          {isEstimated(p, cat) && (
                            <span className="text-muted-foreground">*</span>
                          )}
                        </span>
                        <span className="text-[8px] font-semibold tracking-wider text-muted-foreground">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
